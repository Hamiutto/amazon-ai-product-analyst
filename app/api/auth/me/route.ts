import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAMES,
  getUserByAccessToken,
  parseCookieHeader,
  refreshAuthSession
} from "@/lib/auth";
import { setCsrfCookie } from "@/lib/request-guard";
import { ensureUserProfile } from "@/lib/user-profile";

export const runtime = "nodejs";

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAMES.accessToken, "", { path: "/", maxAge: 0 });
  response.cookies.set(AUTH_COOKIE_NAMES.refreshToken, "", { path: "/", maxAge: 0 });
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const accessToken = parseCookieHeader(cookieHeader, AUTH_COOKIE_NAMES.accessToken);
    const refreshToken = parseCookieHeader(cookieHeader, AUTH_COOKIE_NAMES.refreshToken);

    if (accessToken) {
      try {
        const user = await getUserByAccessToken(accessToken);
        const profile = await ensureUserProfile(user);
        const response = NextResponse.json({ user: { ...user, credits: profile.credits } });
        setCsrfCookie(response);
        return response;
      } catch {
        // fall through to refresh
      }
    }

    if (refreshToken) {
      const refreshed = await refreshAuthSession(refreshToken);
      if (refreshed.session?.user) {
        const profile = await ensureUserProfile(refreshed.session.user);
        const response = NextResponse.json({ user: { ...refreshed.session.user, credits: profile.credits } });
        response.cookies.set(AUTH_COOKIE_NAMES.accessToken, refreshed.session.access_token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: Math.max(refreshed.session.expires_in || 3600, 60)
        });
        response.cookies.set(AUTH_COOKIE_NAMES.refreshToken, refreshed.session.refresh_token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24 * 30
        });
        setCsrfCookie(response);
        return response;
      }
    }

    const response = NextResponse.json({ user: null }, { status: 401 });
    clearSessionCookies(response);
    return response;
  } catch {
    const response = NextResponse.json({ user: null }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }
}
