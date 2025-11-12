import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_COOKIES } from "@/lib/auth/cookies";
import { verifyIdToken } from "@/lib/auth/token";

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIES.session)?.value;
  if (!token) {
    return redirectToLogin(request);
  }

  try {
    await verifyIdToken(token);
    return NextResponse.next();
  } catch {
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/app/:path*"],
};
