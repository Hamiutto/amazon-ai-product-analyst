import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES, parseCookieHeader, signOutWithAccessToken } from "@/lib/auth";

export const runtime = "nodejs";

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAMES.accessToken, "", { path: "/", maxAge: 0 });
  response.cookies.set(AUTH_COOKIE_NAMES.refreshToken, "", { path: "/", maxAge: 0 });
}

export async function POST(request: Request) {
  try {
    const accessToken = parseCookieHeader(request.headers.get("cookie"), AUTH_COOKIE_NAMES.accessToken);
    if (accessToken) {
      try {
        await signOutWithAccessToken(accessToken);
      } catch {
        // clear local session regardless
      }
    }

    const response = NextResponse.json({ ok: true });
    clearSessionCookies(response);
    return response;
  } catch {
    const response = NextResponse.json({ ok: true });
    clearSessionCookies(response);
    return response;
  }
}
