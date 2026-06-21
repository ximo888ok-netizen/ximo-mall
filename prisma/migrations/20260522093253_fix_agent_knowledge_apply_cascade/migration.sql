-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentKnowledgeApply" (
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
    CONSTRAINT "AgentKnowledgeApply_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "StyleKnowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AgentKnowledgeApply" ("agentType", "applyDetails", "applyMethod", "createdAt", "id", "knowledgeId", "projectId", "sectionId", "taskId", "userFeedback", "userRating") SELECT "agentType", "applyDetails", "applyMethod", "createdAt", "id", "knowledgeId", "projectId", "sectionId", "taskId", "userFeedback", "userRating" FROM "AgentKnowledgeApply";
DROP TABLE "AgentKnowledgeApply";
ALTER TABLE "new_AgentKnowledgeApply" RENAME TO "AgentKnowledgeApply";
CREATE INDEX "AgentKnowledgeApply_agentType_idx" ON "AgentKnowledgeApply"("agentType");
CREATE INDEX "AgentKnowledgeApply_projectId_idx" ON "AgentKnowledgeApply"("projectId");
CREATE INDEX "AgentKnowledgeApply_knowledgeId_idx" ON "AgentKnowledgeApply"("knowledgeId");
CREATE INDEX "AgentKnowledgeApply_createdAt_idx" ON "AgentKnowledgeApply"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
