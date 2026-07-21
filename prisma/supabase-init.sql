-- Run this in Supabase SQL Editor if `prisma db push` cannot connect from local tooling.
-- It matches prisma/schema.prisma for the current AnalysisHistory model.

CREATE TABLE IF NOT EXISTS "AnalysisHistory" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "url" TEXT NOT NULL,
    "asin" TEXT,
    "productName" TEXT,
    "imageUrl" TEXT,
    "sourceStatus" TEXT NOT NULL,
    "usedAI" BOOLEAN NOT NULL DEFAULT false,
    "facts" JSONB NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "scriptPlainTextTemp" JSONB,
    "scriptEncrypted" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnalysisHistory_clientId_createdAt_idx" ON "AnalysisHistory"("clientId", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalysisHistory_asin_idx" ON "AnalysisHistory"("asin");
