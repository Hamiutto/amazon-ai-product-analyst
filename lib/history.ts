import { getPrismaClient } from "./prisma";
import { Prisma } from "@prisma/client";
import type { AnalyzeResponse, ProductAnalysisResult } from "./types";

export type CreateAnalysisHistoryInput = AnalyzeResponse & {
  clientId?: string;
};

function resultSnapshotWithoutScript(result: ProductAnalysisResult) {
  const { script: _script, ...snapshot } = result;
  return snapshot;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function rehydrateResult(snapshot: unknown, script: unknown): ProductAnalysisResult {
  return {
    ...(snapshot as Omit<ProductAnalysisResult, "script">),
    script: (script as ProductAnalysisResult["script"]) || {
      hook: "",
      fullText: "",
      sceneSuggestion: ""
    }
  };
}

export async function createAnalysisHistory(input: CreateAnalysisHistoryInput) {
  const prisma = getPrismaClient();
  const productName = input.result.productInfo.name || input.facts.title || input.facts.asin || null;

  return prisma.analysisHistory.create({
    data: {
      clientId: input.clientId || null,
      url: input.facts.url,
      asin: input.facts.asin || null,
      productName,
      imageUrl: input.facts.imageUrl || null,
      sourceStatus: input.facts.sourceStatus,
      usedAI: input.usedAI,
      facts: toJsonValue(input.facts),
      resultSnapshot: toJsonValue(resultSnapshotWithoutScript(input.result)),
      scriptPlainTextTemp: toJsonValue(input.result.script)
    },
    select: {
      id: true,
      clientId: true,
      url: true,
      asin: true,
      productName: true,
      imageUrl: true,
      sourceStatus: true,
      usedAI: true,
      createdAt: true
    }
  });
}

export async function listAnalysisHistory(clientId?: string) {
  const prisma = getPrismaClient();

  return prisma.analysisHistory.findMany({
    where: clientId ? { clientId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      clientId: true,
      url: true,
      asin: true,
      productName: true,
      imageUrl: true,
      sourceStatus: true,
      usedAI: true,
      createdAt: true
    }
  });
}

export async function getAnalysisHistory(id: string, clientId?: string) {
  const prisma = getPrismaClient();

  const item = await prisma.analysisHistory.findFirst({
    where: {
      id,
      ...(clientId ? { clientId } : {})
    }
  });

  if (!item) return null;

  return {
    id: item.id,
    clientId: item.clientId,
    createdAt: item.createdAt,
    facts: item.facts,
    result: rehydrateResult(item.resultSnapshot, item.scriptPlainTextTemp),
    usedAI: item.usedAI
  };
}

export async function deleteAnalysisHistory(id: string, clientId?: string) {
  const prisma = getPrismaClient();

  const item = await prisma.analysisHistory.findFirst({
    where: {
      id,
      ...(clientId ? { clientId } : {})
    },
    select: { id: true }
  });

  if (!item) return false;

  await prisma.analysisHistory.delete({ where: { id } });
  return true;
}
