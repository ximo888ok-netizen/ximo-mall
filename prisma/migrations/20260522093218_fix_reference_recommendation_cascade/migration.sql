-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReferenceRecommendation" (
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
    CONSTRAINT "ReferenceRecommendation_learningImageId_fkey" FOREIGN KEY ("learningImageId") REFERENCES "LearningImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReferenceRecommendation" ("adoptedAt", "createdAt", "id", "isAdopted", "learningImageId", "matchScore", "matchedKnowledgeIds", "projectId", "reason", "sectionId", "taskType") SELECT "adoptedAt", "createdAt", "id", "isAdopted", "learningImageId", "matchScore", "matchedKnowledgeIds", "projectId", "reason", "sectionId", "taskType" FROM "ReferenceRecommendation";
DROP TABLE "ReferenceRecommendation";
ALTER TABLE "new_ReferenceRecommendation" RENAME TO "ReferenceRecommendation";
CREATE INDEX "ReferenceRecommendation_projectId_idx" ON "ReferenceRecommendation"("projectId");
CREATE INDEX "ReferenceRecommendation_sectionId_idx" ON "ReferenceRecommendation"("sectionId");
CREATE INDEX "ReferenceRecommendation_learningImageId_idx" ON "ReferenceRecommendation"("learningImageId");
CREATE INDEX "ReferenceRecommendation_isAdopted_idx" ON "ReferenceRecommendation"("isAdopted");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
