-- CreateTable
CREATE TABLE "KnowledgeConstraints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentType" TEXT NOT NULL,
    "minConfidence" REAL NOT NULL DEFAULT 0.5,
    "maxConfidence" REAL NOT NULL DEFAULT 1.0,
    "maxAppliesPerDay" INTEGER NOT NULL DEFAULT 50,
    "maxAppliesPerSession" INTEGER NOT NULL DEFAULT 10,
    "allowedTypes" JSONB,
    "blockedTypes" JSONB,
    "maxPromptLength" INTEGER NOT NULL DEFAULT 500,
    "enableNegative" BOOLEAN NOT NULL DEFAULT true,
    "trackEffectiveness" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeApplyLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "projectId" TEXT,
    "sessionId" TEXT,
    "applyMethod" TEXT NOT NULL,
    "promptSnippet" TEXT,
    "rating" INTEGER,
    "feedback" TEXT,
    "wasHelpful" BOOLEAN,
    "passedConstraints" BOOLEAN NOT NULL,
    "failedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "KnowledgeConstraints_isActive_idx" ON "KnowledgeConstraints"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeConstraints_agentType_key" ON "KnowledgeConstraints"("agentType");

-- CreateIndex
CREATE INDEX "KnowledgeApplyLog_knowledgeId_idx" ON "KnowledgeApplyLog"("knowledgeId");

-- CreateIndex
CREATE INDEX "KnowledgeApplyLog_agentType_idx" ON "KnowledgeApplyLog"("agentType");

-- CreateIndex
CREATE INDEX "KnowledgeApplyLog_createdAt_idx" ON "KnowledgeApplyLog"("createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeApplyLog_rating_idx" ON "KnowledgeApplyLog"("rating");
