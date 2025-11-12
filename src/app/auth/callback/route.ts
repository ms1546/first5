import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIES, defaultCookieOptions } from "@/lib/auth/cookies";
import { exchangeCodeForTokens } from "@/lib/auth/cognito";
import { verifyIdToken } from "@/lib/auth/token";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const pkceCookie = request.cookies.get(AUTH_COOKIES.pkce)?.value;

  if (error) {
    return redirectWithError(request, error);
  }

  if (!code || !state || !pkceCookie) {
    return redirectWithError(request, "invalid_request");
  }

  let pkceSession: { codeVerifier: string; state: string; redirectTo?: string };
  try {
    pkceSession = JSON.parse(pkceCookie);
  } catch {
    return redirectWithError(request, "invalid_session");
  }

  if (!pkceSession.codeVerifier || pkceSession.state !== state) {
    return redirectWithError(request, "state_mismatch");
  }

  try {
    const tokenResponse = await exchangeCodeForTokens({
      code,
      codeVerifier: pkceSession.codeVerifier,
    });

    const payload = await verifyIdToken(tokenResponse.id_token);
    const redirectTo = sanitizeRedirect(pkceSession.redirectTo ?? "/app");
    const response = NextResponse.redirect(redirectTo);
    response.cookies.set(AUTH_COOKIES.pkce, "", { ...defaultCookieOptions, maxAge: 0 });
    response.cookies.set(AUTH_COOKIES.session, tokenResponse.id_token, {
      ...defaultCookieOptions,
      expires: new Date(payload.exp * 1000),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return redirectWithError(request, "token_exchange_failed");
  }
}

function redirectWithError(request: NextRequest, code: string) {
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("error", code);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(AUTH_COOKIES.pkce, "", { ...defaultCookieOptions, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function sanitizeRedirect(target: string) {
  if (!target.startsWith("/")) {
    return "/app";
  }
  if (target.startsWith("//") || target.startsWith("/\\")) {
    return "/app";
  }
  return target;
}
