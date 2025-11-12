import { authConfig, authPaths } from "./config";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const subtleCrypto = globalThis.crypto?.subtle;

if (!subtleCrypto) {
  throw new Error("WebCrypto API is unavailable in this runtime.");
}

const JWKS_TTL_MS = 1000 * 60 * 10;
let cachedJwks: CognitoJwk[] | null = null;
let jwksFetchedAt = 0;
const keyCache = new Map<string, CryptoKey>();

interface CognitoJwk {
  kid: string;
  kty: "RSA";
  n: string;
  e: string;
  alg: string;
  use?: string;
}

export type IdTokenPayload = {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  nbf?: number;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  token_use: string;
  [key: string]: unknown;
};

export async function verifyIdToken(token: string): Promise<IdTokenPayload> {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error("Invalid ID token format");
  }

  const header = JSON.parse(base64UrlDecodeToString(headerB64)) as {
    kid: string;
    alg: string;
    typ: string;
  };

  const cryptoKey = await getCryptoKey(header.kid);
  const signingInput = `${headerB64}.${payloadB64}`;
  const signatureBytes = base64UrlDecode(signatureB64);
  const verified = await subtleCrypto.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    signatureBytes,
    textEncoder.encode(signingInput)
  );

  if (!verified) {
    throw new Error("Invalid ID token signature");
  }

  const payload = JSON.parse(base64UrlDecodeToString(payloadB64)) as IdTokenPayload;
  validateClaims(payload);
  return payload;
}

function validateClaims(payload: IdTokenPayload) {
  if (payload.iss !== authPaths.issuer) {
    throw new Error("Unexpected issuer");
  }
  if (payload.aud !== authConfig.clientId) {
    throw new Error("Unexpected audience");
  }
  if (payload.token_use !== "id") {
    throw new Error("Token is not an ID token");
  }
  const now = Date.now() / 1000;
  if (payload.exp <= now) {
    throw new Error("ID token expired");
  }
  if (payload.nbf && payload.nbf > now + 60) {
    throw new Error("ID token not yet valid");
  }
}

async function getCryptoKey(kid: string): Promise<CryptoKey> {
  const cached = keyCache.get(kid);
  if (cached) {
    return cached;
  }
  const jwk = await findJwk(kid);
  const key = await subtleCrypto.importKey(
    "jwk",
    {
      kty: jwk.kty,
      e: jwk.e,
      n: jwk.n,
      alg: jwk.alg,
      ext: true,
    },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  keyCache.set(kid, key);
  return key;
}

async function findJwk(kid: string): Promise<CognitoJwk> {
  const jwks = await getJwks();
  const match = jwks.find((key) => key.kid === kid);
  if (match) {
    return match;
  }
  // Cache miss: refetch once
  cachedJwks = null;
  const refreshed = await getJwks();
  const refreshedMatch = refreshed.find((key) => key.kid === kid);
  if (!refreshedMatch) {
    throw new Error(`JWK not found for kid: ${kid}`);
  }
  return refreshedMatch;
}

async function getJwks(): Promise<CognitoJwk[]> {
  const stale = !cachedJwks || Date.now() - jwksFetchedAt > JWKS_TTL_MS;
  if (!stale && cachedJwks) {
    return cachedJwks;
  }
  const response = await fetch(authPaths.jwks, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load Cognito JWKs");
  }
  const json = (await response.json()) as { keys: CognitoJwk[] };
  cachedJwks = json.keys;
  jwksFetchedAt = Date.now();
  return cachedJwks ?? [];
}

function base64UrlDecode(input: string): Uint8Array {
  const base64 = toBase64(input);
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const output: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;

  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned.charAt(i);
    if (char === "=") {
      break;
    }
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      output.push((buffer >> bitsCollected) & 0xff);
    }
  }

  return new Uint8Array(output);
}

function base64UrlDecodeToString(input: string): string {
  return textDecoder.decode(base64UrlDecode(input));
}

function toBase64(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  if (pad === 0) {
    return normalized;
  }
  return normalized + "=".repeat(4 - pad);
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
