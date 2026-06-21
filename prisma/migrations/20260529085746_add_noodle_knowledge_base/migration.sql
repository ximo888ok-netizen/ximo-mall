-- CreateTable
CREATE TABLE "NoodleKnowledgeBase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "knowledgeCount" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NoodleKBImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kbId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "analysisResult" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "analyzedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoodleKBImage_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "NoodleKnowledgeBase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoodleKBKnowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kbId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attributes" JSONB,
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "sampleCount" INTEGER NOT NULL DEFAULT 1,
    "sourceImageIds" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NoodleKBKnowledge_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "NoodleKnowledgeBase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NoodleKnowledgeBase_slug_key" ON "NoodleKnowledgeBase"("slug");

-- CreateIndex
CREATE INDEX "NoodleKnowledgeBase_status_idx" ON "NoodleKnowledgeBase"("status");

-- CreateIndex
CREATE INDEX "NoodleKnowledgeBase_createdAt_idx" ON "NoodleKnowledgeBase"("createdAt");

-- CreateIndex
CREATE INDEX "NoodleKBImage_kbId_idx" ON "NoodleKBImage"("kbId");

-- CreateIndex
CREATE INDEX "NoodleKBImage_status_idx" ON "NoodleKBImage"("status");

-- CreateIndex
CREATE INDEX "NoodleKBImage_category_idx" ON "NoodleKBImage"("category");

-- CreateIndex
CREATE INDEX "NoodleKBKnowledge_kbId_idx" ON "NoodleKBKnowledge"("kbId");

-- CreateIndex
CREATE INDEX "NoodleKBKnowledge_type_idx" ON "NoodleKBKnowledge"("type");

-- CreateIndex
CREATE INDEX "NoodleKBKnowledge_isActive_idx" ON "NoodleKBKnowledge"("isActive");

-- CreateIndex
CREATE INDEX "NoodleKBKnowledge_confidence_idx" ON "NoodleKBKnowledge"("confidence");
