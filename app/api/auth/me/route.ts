import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAMES,
  getUserByAccessToken,
  parseCookieHeader,
  refreshAuthSession
} from "@/lib/auth";

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
        return NextResponse.json({ user });
      } catch {
        // fall through to refresh
      }
    }

    if (refreshToken) {
      const refreshed = await refreshAuthSession(refreshToken);
      if (refreshed.session?.user) {
        const response = NextResponse.json({ user: refreshed.session.user });
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
