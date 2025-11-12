import type { CookieOptions } from "next/dist/server/web/spec-extension/cookies";

const isProduction = process.env.NODE_ENV === "production";

export const AUTH_COOKIES = {
  session: "first5_id_token",
  pkce: "first5_pkce",
};

export const defaultCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};

export const pkceCookieOptions: CookieOptions = {
  ...defaultCookieOptions,
  maxAge: 60 * 5, // 5 minutes
};
