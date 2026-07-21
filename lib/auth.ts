import type { AuthUser } from "./types";

export const AUTH_COOKIE_NAMES = {
  accessToken: "aa-auth-access-token",
  refreshToken: "aa-auth-refresh-token"
} as const;

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: AuthUser;
};

type SupabaseAuthEnvelope = {
  user?: AuthUser;
  session?: AuthSession | null;
  message?: string;
};

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("缺少 Supabase Auth 配置，请设置 SUPABASE_URL 和 SUPABASE_ANON_KEY。");
  }

  return {
    url: url.replace(/\/$/, ""),
    anonKey
  };
}

export function parseCookieHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}

export async function supabaseAuthRequest<T>(path: string, init: RequestInit = {}) {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    msg?: string;
  };

  if (!response.ok) {
    const message = (payload as { error?: string; msg?: string }).error || (payload as { error?: string; msg?: string }).msg || "Supabase Auth 请求失败。";
    throw new Error(message);
  }

  return payload;
}

export async function signUpWithPassword(email: string, password: string) {
  return supabaseAuthRequest<SupabaseAuthEnvelope>("signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password
    })
  });
}

export async function signInWithPassword(email: string, password: string) {
  return supabaseAuthRequest<SupabaseAuthEnvelope>("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({
      email,
      password
    })
  });
}

export async function refreshAuthSession(refreshToken: string) {
  return supabaseAuthRequest<SupabaseAuthEnvelope>("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({
      refresh_token: refreshToken
    })
  });
}

export async function getUserByAccessToken(accessToken: string) {
  return supabaseAuthRequest<AuthUser>("user", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

export async function signOutWithAccessToken(accessToken: string) {
  return supabaseAuthRequest<Record<string, never>>("logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

export function getSessionCookies(session: AuthSession) {
  const maxAge = Math.max(session.expires_in || 3600, 60);

  return {
    accessToken: {
      value: session.access_token,
      options: buildCookieOptions(maxAge)
    },
    refreshToken: {
      value: session.refresh_token,
      options: buildCookieOptions(60 * 60 * 24 * 30)
    }
  };
}
