import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES, getUserByAccessToken, parseCookieHeader } from "@/lib/auth";
import { createAnalysisHistory, listAnalysisHistory } from "@/lib/history";
import type { AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";

function historyError(message: string, error: unknown) {
  console.error(message, error);

  const detail = error instanceof Error ? error.message : "";
  if (/AnalysisHistory.*does not exist|does not exist in the current database|P2021/i.test(detail)) {
    return NextResponse.json({ error: `${message}：历史数据表尚未创建，请先完成 Supabase 数据库初始化。` }, { status: 500 });
  }

  const suffix = process.env.NODE_ENV === "development" && detail ? `：${detail}` : "。";
  return NextResponse.json({ error: `${message}${suffix}` }, { status: 500 });
}

async function historyOwner(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || undefined;
  const accessToken = parseCookieHeader(request.headers.get("cookie"), AUTH_COOKIE_NAMES.accessToken);
  if (accessToken) {
    try {
      const user = await getUserByAccessToken(accessToken);
      return { userId: user.id, clientId };
    } catch {
      // fall back to clientId compatibility
    }
  }

  return { clientId };
}

export async function GET(request: Request) {
  try {
    const items = await listAnalysisHistory(await historyOwner(request));

    return NextResponse.json({ items });
  } catch (error) {
    return historyError("读取历史记录失败", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AnalyzeResponse> & {
      clientId?: string;
    };

    if (!body.facts || !body.result || typeof body.usedAI !== "boolean") {
      return NextResponse.json({ error: "历史记录数据不完整。" }, { status: 400 });
    }

    const item = await createAnalysisHistory({
      userId: (await historyOwner(request)).userId,
      clientId: body.clientId,
      facts: body.facts,
      result: body.result,
      usedAI: body.usedAI
    });

    return NextResponse.json({ item });
  } catch (error) {
    return historyError("保存历史记录失败", error);
  }
}
