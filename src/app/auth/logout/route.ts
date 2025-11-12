import { NextResponse } from "next/server";
import { authConfig, authPaths } from "@/lib/auth/config";
import { AUTH_COOKIES, defaultCookieOptions } from "@/lib/auth/cookies";

export const runtime = "nodejs";

export async function GET() {
  const logoutUrl = new URL(authPaths.logout);
  logoutUrl.searchParams.set("client_id", authConfig.clientId);
  logoutUrl.searchParams.set("logout_uri", authConfig.logoutRedirectUri);

  const response = NextResponse.redirect(logoutUrl);
  response.cookies.set(AUTH_COOKIES.session, "", { ...defaultCookieOptions, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
