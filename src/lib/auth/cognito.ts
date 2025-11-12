import { authConfig, authPaths } from "./config";

export type TokenResponse = {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
};

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: authConfig.clientId,
    redirect_uri: authConfig.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(authPaths.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to exchange authorization code for tokens");
  }

  return (await response.json()) as TokenResponse;
}
