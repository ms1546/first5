import { cookies } from "next/headers";
import { AUTH_COOKIES } from "./cookies";
import { verifyIdToken, type IdTokenPayload } from "./token";

type SessionUser = {
  sub: string;
  email?: string;
  name?: string;
};

export type Session = {
  user: SessionUser | null;
  claims: IdTokenPayload | null;
};

export async function getSession(): Promise<Session> {
  const token = cookies().get(AUTH_COOKIES.session)?.value;
  if (!token) {
    return { user: null, claims: null };
  }

  try {
    const payload = await verifyIdToken(token);
    return {
      user: {
        sub: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
        name:
          typeof payload.name === "string"
            ? payload.name
            : typeof payload.email === "string"
              ? payload.email
              : undefined,
      },
      claims: payload,
    };
  } catch {
    return { user: null, claims: null };
  }
}
