import type { AuthUser } from "./types";

export const AUTH_COOKIE_NAMES = {
  accessToken: "aa-auth-access-token",
  refreshToken: "aa-auth-refresh-token",
  csrfToken: "aa-csrf-token"
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

export function translateAuthError(message: string) {
  if (/[\u4e00-\u9fff]/.test(message)) return message;

  const normalized = message.toLowerCase();

  if (normalized.includes("only request this after")) {
    const seconds = message.match(/after\s+(\d+)\s+seconds/i)?.[1];
    return seconds ? `请求过于频繁，请 ${seconds} 秒后重试。` : "请求过于频繁，请稍后重试。";
  }
  if (normalized.includes("invalid login credentials")) return "邮箱或密码不正确。";
  if (normalized.includes("email not confirmed")) return "邮箱尚未验证，请先完成邮箱验证。";
  if (normalized.includes("user already registered") || normalized.includes("already exists")) return "该邮箱已注册，请直接登录。";
  if (normalized.includes("password should be") || normalized.includes("weak password")) return "密码强度不足，请按页面提示重新设置。";
  if (normalized.includes("invalid email")) return "邮箱格式不正确，请检查后重试。";
  if (normalized.includes("signup disabled")) return "当前暂未开放注册。";
  if (normalized.includes("rate limit")) return "请求过于频繁，请稍后重试。";
  if (normalized.includes("缺少 supabase auth 配置")) return message;

  return "认证请求失败，请稍后重试。";
}

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
    throw new Error(translateAuthError(message));
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
  const response = await supabaseAuthRequest<AuthSession>("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({
      email,
      password
    })
  });

  return {
    user: response.user,
    session: response
  };
}

export async function refreshAuthSession(refreshToken: string) {
  const response = await supabaseAuthRequest<AuthSession>("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({
      refresh_token: refreshToken
    })
  });

  return {
    user: response.user,
    session: response
  };
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
