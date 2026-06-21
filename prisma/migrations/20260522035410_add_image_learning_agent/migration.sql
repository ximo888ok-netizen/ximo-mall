-- CreateTable
CREATE TABLE "LearningSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "targetTypes" JSONB NOT NULL,
    "autoApply" BOOLEAN NOT NULL DEFAULT true,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "knowledgeCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LearningImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "analyzedAt" DATETIME,
    "analysisResult" JSONB,
    "userTags" TEXT,
    "userNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearningImage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LearningSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StyleKnowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "promptSnippet" TEXT,
    "negativePrompt" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "sampleCount" INTEGER NOT NULL DEFAULT 1,
    "applyCount" INTEGER NOT NULL DEFAULT 0,
    "lastAppliedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StyleKnowledge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LearningSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "attributes" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeSource_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "StyleKnowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeSource_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "LearningImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentKnowledgeApply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentType" TEXT NOT NULL,
    "projectId" TEXT,
    "sectionId" TEXT,
    "taskId" TEXT,
    "knowledgeId" TEXT NOT NULL,
    "applyMethod" TEXT NOT NULL,
    "applyDetails" JSONB NOT NULL,
    "userRating" INTEGER,
    "userFeedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentKnowledgeApply_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "StyleKnowledge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReferenceRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sectionId" TEXT,
    "taskType" TEXT NOT NULL,
    "learningImageId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "matchScore" REAL NOT NULL,
    "matchedKnowledgeIds" JSONB NOT NULL,
    "isAdopted" BOOLEAN NOT NULL DEFAULT false,
    "adoptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferenceRecommendation_learningImageId_fkey" FOREIGN KEY ("learningImageId") REFERENCES "LearningImage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LearningSession_status_idx" ON "LearningSession"("status");

-- CreateIndex
CREATE INDEX "LearningSession_createdAt_idx" ON "LearningSession"("createdAt");

-- CreateIndex
CREATE INDEX "LearningImage_sessionId_idx" ON "LearningImage"("sessionId");

-- CreateIndex
CREATE INDEX "LearningImage_status_idx" ON "LearningImage"("status");

-- CreateIndex
CREATE INDEX "LearningImage_sourceType_sourceId_idx" ON "LearningImage"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "StyleKnowledge_sessionId_idx" ON "StyleKnowledge"("sessionId");

-- CreateIndex
CREATE INDEX "StyleKnowledge_type_idx" ON "StyleKnowledge"("type");

-- CreateIndex
CREATE INDEX "StyleKnowledge_isActive_idx" ON "StyleKnowledge"("isActive");

-- CreateIndex
CREATE INDEX "StyleKnowledge_confidence_idx" ON "StyleKnowledge"("confidence");

-- CreateIndex
CREATE INDEX "KnowledgeSource_knowledgeId_idx" ON "KnowledgeSource"("knowledgeId");

-- CreateIndex
CREATE INDEX "KnowledgeSource_imageId_idx" ON "KnowledgeSource"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSource_knowledgeId_imageId_key" ON "KnowledgeSource"("knowledgeId", "imageId");

-- CreateIndex
CREATE INDEX "AgentKnowledgeApply_agentType_idx" ON "AgentKnowledgeApply"("agentType");

-- CreateIndex
CREATE INDEX "AgentKnowledgeApply_projectId_idx" ON "AgentKnowledgeApply"("projectId");

-- CreateIndex
CREATE INDEX "AgentKnowledgeApply_knowledgeId_idx" ON "AgentKnowledgeApply"("knowledgeId");

-- CreateIndex
CREATE INDEX "AgentKnowledgeApply_createdAt_idx" ON "AgentKnowledgeApply"("createdAt");

-- CreateIndex
CREATE INDEX "ReferenceRecommendation_projectId_idx" ON "ReferenceRecommendation"("projectId");

-- CreateIndex
CREATE INDEX "ReferenceRecommendation_sectionId_idx" ON "ReferenceRecommendation"("sectionId");

-- CreateIndex
CREATE INDEX "ReferenceRecommendation_learningImageId_idx" ON "ReferenceRecommendation"("learningImageId");

-- CreateIndex
CREATE INDEX "ReferenceRecommendation_isAdopted_idx" ON "ReferenceRecommendation"("isAdopted");
