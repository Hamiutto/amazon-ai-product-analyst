import { NextResponse } from "next/server";
import { getSessionCookies, signUpWithPassword, translateAuthError } from "@/lib/auth";
import { getPasswordPolicyError } from "@/lib/password-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码。" }, { status: 400 });
    }

    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const envelope = await signUpWithPassword(email, password);
    if (!envelope.user) {
      return NextResponse.json({ error: "注册失败。" }, { status: 400 });
    }

    const response = NextResponse.json({
      user: envelope.user,
      signedIn: Boolean(envelope.session)
    });

    if (envelope.session) {
      const cookies = getSessionCookies(envelope.session);
      response.cookies.set("aa-auth-access-token", cookies.accessToken.value, cookies.accessToken.options);
      response.cookies.set("aa-auth-refresh-token", cookies.refreshToken.value, cookies.refreshToken.options);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? translateAuthError(error.message) : "注册失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
