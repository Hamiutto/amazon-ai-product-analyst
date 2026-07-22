import { NextResponse } from "next/server";
import { extractAmazonFacts } from "@/lib/amazon";
import { AUTH_COOKIE_NAMES, getUserByAccessToken, parseCookieHeader } from "@/lib/auth";
import { analyzeWithDeepSeek } from "@/lib/deepseek";
import { createAnalysisHistory } from "@/lib/history";
import { getPrismaClient } from "@/lib/prisma";
import { ManualProductInput } from "@/lib/types";
import { analysisCreditCost, ensureUserProfile } from "@/lib/user-profile";

export const runtime = "nodejs";
export const maxDuration = 30;

async function getCurrentUser(request: Request) {
  const accessToken = parseCookieHeader(request.headers.get("cookie"), AUTH_COOKIE_NAMES.accessToken);
  return accessToken ? getUserByAccessToken(accessToken) : null;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "请先登录后再分析。" }, { status: 401 });
    }

    const body = (await request.json()) as {
      url?: string;
      manual?: ManualProductInput;
      clientId?: string;
    };

    if (!body.url) {
      return NextResponse.json({ error: "请输入 Amazon 商品链接。" }, { status: 400 });
    }

    const profile = await ensureUserProfile(user);
    if (profile.credits < analysisCreditCost) {
      return NextResponse.json({ error: "积分不足，无法开始分析。", credits: profile.credits }, { status: 402 });
    }

    const facts = await extractAmazonFacts(body.url, body.manual);
    const { result, usedAI } = await analyzeWithDeepSeek(facts);
    const prisma = getPrismaClient();

    const saved = await prisma.$transaction(async (tx) => {
      await ensureUserProfile(user, tx);

      const history = await createAnalysisHistory(
        {
          userId: user.id,
          clientId: body.clientId,
          facts,
          result,
          usedAI
        },
        tx
      );

      const debit = await tx.userProfile.updateMany({
        where: {
          userId: user.id,
          credits: {
            gte: analysisCreditCost
          }
        },
        data: {
          credits: {
            decrement: analysisCreditCost
          }
        }
      });

      if (debit.count !== 1) {
        throw new Error("积分不足，无法保存分析结果。");
      }

      const nextProfile = await tx.userProfile.findUniqueOrThrow({
        where: { userId: user.id }
      });

      await tx.creditLedger.create({
        data: {
          userId: user.id,
          amount: -analysisCreditCost,
          reason: "analysis",
          analysisHistoryId: history.id
        }
      });

      return {
        history,
        profile: nextProfile
      };
    });

    return NextResponse.json({
      facts,
      result,
      usedAI,
      historyId: saved.history.id,
      credits: saved.profile.credits
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
