import { NextResponse } from "next/server";
import { extractAmazonFacts } from "@/lib/amazon";
import { analyzeWithDeepSeek } from "@/lib/deepseek";
import { ManualProductInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
      manual?: ManualProductInput;
    };

    if (!body.url) {
      return NextResponse.json({ error: "请输入 Amazon 商品链接。" }, { status: 400 });
    }

    const facts = await extractAmazonFacts(body.url, body.manual);
    const { result, usedAI } = await analyzeWithDeepSeek(facts);

    return NextResponse.json({
      facts,
      result,
      usedAI
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
