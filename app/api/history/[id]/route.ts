import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAMES, getUserByAccessToken, parseCookieHeader } from "@/lib/auth";
import { deleteAnalysisHistory, getAnalysisHistory } from "@/lib/history";
import { verifyWriteRequest } from "@/lib/request-guard";

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

type Params = {
  params: {
    id: string;
  };
};

function clientIdFromRequest(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("clientId") || undefined;
}

async function historyOwner(request: Request) {
  const clientId = clientIdFromRequest(request);
  const accessToken = parseCookieHeader(request.headers.get("cookie"), AUTH_COOKIE_NAMES.accessToken);
  if (accessToken) {
    try {
      const user = await getUserByAccessToken(accessToken);
      return { userId: user.id };
    } catch {
      // fall back to clientId compatibility
    }
  }

  return { clientId };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const item = await getAnalysisHistory(params.id, await historyOwner(request));

    if (!item) {
      return NextResponse.json({ error: "历史记录不存在。" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return historyError("读取历史详情失败", error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const guard = verifyWriteRequest(request);
    if (guard) return guard;

    const deleted = await deleteAnalysisHistory(params.id, await historyOwner(request));

    if (!deleted) {
      return NextResponse.json({ error: "历史记录不存在。" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return historyError("删除历史记录失败", error);
  }
}
