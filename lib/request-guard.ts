import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { AUTH_COOKIE_NAMES, buildCookieOptions, parseCookieHeader } from "./auth";

const csrfHeaderName = "x-aa-csrf-token";

export function createCsrfToken() {
  return randomBytes(32).toString("base64url");
}

export function setCsrfCookie(response: NextResponse, token = createCsrfToken()) {
  response.cookies.set(AUTH_COOKIE_NAMES.csrfToken, token, {
    ...buildCookieOptions(60 * 60 * 24),
    httpOnly: false
  });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  return origin === new URL(request.url).origin;
}

export function verifyWriteRequest(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "请求来源校验失败。" }, { status: 403 });
  }

  const cookieToken = parseCookieHeader(request.headers.get("cookie"), AUTH_COOKIE_NAMES.csrfToken);
  const headerToken = request.headers.get(csrfHeaderName) || "";

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ error: "请求校验失败，请刷新页面后重试。" }, { status: 403 });
  }

  return null;
}
