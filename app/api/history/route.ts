import { NextResponse } from "next/server";
import { createAnalysisHistory, listAnalysisHistory } from "@/lib/history";
import type { AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId") || undefined;
    const items = await listAnalysisHistory(clientId);

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "读取历史记录失败。" }, { status: 500 });
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
      clientId: body.clientId,
      facts: body.facts,
      result: body.result,
      usedAI: body.usedAI
    });

    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "保存历史记录失败。" }, { status: 500 });
  }
}
