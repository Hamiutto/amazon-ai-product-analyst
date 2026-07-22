import { NextResponse } from "next/server";
import { signUpWithPassword, translateAuthError } from "@/lib/auth";
import { getPasswordPolicyError } from "@/lib/password-policy";
import { ensureUserProfile } from "@/lib/user-profile";

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

    await ensureUserProfile(envelope.user);

    return NextResponse.json({
      user: envelope.user,
      signedIn: false
    });
  } catch (error) {
    const message = error instanceof Error ? translateAuthError(error.message) : "注册失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
