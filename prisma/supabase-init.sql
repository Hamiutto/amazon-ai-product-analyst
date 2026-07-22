-- Run this in Supabase SQL Editor if `prisma db push` cannot connect from local tooling.
-- It matches prisma/schema.prisma for the current user, credit, and history models.

CREATE TABLE IF NOT EXISTS "AnalysisHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
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

ALTER TABLE "AnalysisHistory" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE TABLE IF NOT EXISTS "UserProfile" (
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "CreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "analysisHistoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AnalysisHistory_userId_fkey'
    ) THEN
        ALTER TABLE "AnalysisHistory"
        ADD CONSTRAINT "AnalysisHistory_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CreditLedger_userId_fkey'
    ) THEN
        ALTER TABLE "CreditLedger"
        ADD CONSTRAINT "CreditLedger_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "AnalysisHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditLedger" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "AnalysisHistory_userId_createdAt_idx" ON "AnalysisHistory"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalysisHistory_clientId_createdAt_idx" ON "AnalysisHistory"("clientId", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalysisHistory_asin_idx" ON "AnalysisHistory"("asin");
CREATE INDEX IF NOT EXISTS "CreditLedger_userId_createdAt_idx" ON "CreditLedger"("userId", "createdAt");
