import { getPrismaClient } from "./prisma";
import { Prisma } from "@prisma/client";
import type { AnalyzeResponse, ProductAnalysisResult } from "./types";

export type CreateAnalysisHistoryInput = AnalyzeResponse & {
  userId?: string;
  clientId?: string;
};

type HistoryOwner = {
  userId?: string;
  clientId?: string;
};

function ownerWhere(owner: HistoryOwner) {
  if (owner.userId && owner.clientId) {
    return {
      OR: [
        { userId: owner.userId },
        {
          userId: null,
          clientId: owner.clientId
        }
      ]
    };
  }

  if (owner.userId) return { userId: owner.userId };
  if (owner.clientId) return { clientId: owner.clientId };
  return undefined;
}

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

export async function createAnalysisHistory(input: CreateAnalysisHistoryInput, prisma: Prisma.TransactionClient = getPrismaClient()) {
  const productName = input.result.productInfo.name || input.facts.title || input.facts.asin || null;

  return prisma.analysisHistory.create({
    data: {
      userId: input.userId || null,
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
      userId: true,
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

export async function listAnalysisHistory(owner: HistoryOwner = {}) {
  const prisma = getPrismaClient();

  return prisma.analysisHistory.findMany({
    where: ownerWhere(owner),
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      userId: true,
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

export async function getAnalysisHistory(id: string, owner: HistoryOwner = {}) {
  const prisma = getPrismaClient();

  const item = await prisma.analysisHistory.findFirst({
    where: {
      id,
      ...ownerWhere(owner)
    }
  });

  if (!item) return null;

  return {
    id: item.id,
    userId: item.userId,
    clientId: item.clientId,
    createdAt: item.createdAt,
    facts: item.facts,
    result: rehydrateResult(item.resultSnapshot, item.scriptPlainTextTemp),
    usedAI: item.usedAI
  };
}

export async function deleteAnalysisHistory(id: string, owner: HistoryOwner = {}) {
  const prisma = getPrismaClient();

  const item = await prisma.analysisHistory.findFirst({
    where: {
      id,
      ...ownerWhere(owner)
    },
    select: { id: true }
  });

  if (!item) return false;

  await prisma.analysisHistory.delete({ where: { id } });
  return true;
}
