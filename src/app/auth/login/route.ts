import { randomBytes, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authConfig, authPaths } from "@/lib/auth/config";
import { AUTH_COOKIES, pkceCookieOptions } from "@/lib/auth/cookies";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const redirectTo = sanitizeRedirect(
    request.nextUrl.searchParams.get("redirectTo") ?? "/app"
  );

  const codeVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = base64UrlEncode(
    createHash("sha256").update(codeVerifier).digest()
  );
  const state = base64UrlEncode(randomBytes(16));

  const authorizeUrl = new URL(authPaths.authorize);
  authorizeUrl.searchParams.set("client_id", authConfig.clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", authConfig.scopes.join(" "));
  authorizeUrl.searchParams.set("redirect_uri", authConfig.redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    AUTH_COOKIES.pkce,
    JSON.stringify({ codeVerifier, state, redirectTo }),
    pkceCookieOptions
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function sanitizeRedirect(target: string): string {
  if (!target.startsWith("/")) {
    return "/app";
  }
  if (target.startsWith("//") || target.startsWith("/\\")) {
    return "/app";
  }
  return target;
}

function base64UrlEncode(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
