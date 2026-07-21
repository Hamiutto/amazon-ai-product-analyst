import { NextResponse } from "next/server";
import { deleteAnalysisHistory, getAnalysisHistory } from "@/lib/history";

export const runtime = "nodejs";

type Params = {
  params: {
    id: string;
  };
};

function clientIdFromRequest(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("clientId") || undefined;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const item = await getAnalysisHistory(params.id, clientIdFromRequest(request));

    if (!item) {
      return NextResponse.json({ error: "历史记录不存在。" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "读取历史详情失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const deleted = await deleteAnalysisHistory(params.id, clientIdFromRequest(request));

    if (!deleted) {
      return NextResponse.json({ error: "历史记录不存在。" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "删除历史记录失败。" }, { status: 500 });
  }
}
