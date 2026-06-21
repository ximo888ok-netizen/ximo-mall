-- CreateTable
CREATE TABLE "ImageCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImageCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ImageCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImageLibraryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImageLibraryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ImageCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageLibraryItemTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "ImageLibraryItemTag_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ImageLibraryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageLibraryItemTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ImageTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImageId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImageCollectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ImageCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageCollectionItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ImageLibraryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageCategory_name_key" ON "ImageCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ImageCategory_slug_key" ON "ImageCategory"("slug");

-- CreateIndex
CREATE INDEX "ImageCategory_parentId_idx" ON "ImageCategory"("parentId");

-- CreateIndex
CREATE INDEX "ImageCategory_slug_idx" ON "ImageCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ImageTag_name_key" ON "ImageTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ImageTag_slug_key" ON "ImageTag"("slug");

-- CreateIndex
CREATE INDEX "ImageTag_slug_idx" ON "ImageTag"("slug");

-- CreateIndex
CREATE INDEX "ImageLibraryItem_categoryId_idx" ON "ImageLibraryItem"("categoryId");

-- CreateIndex
CREATE INDEX "ImageLibraryItem_createdAt_idx" ON "ImageLibraryItem"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageLibraryItemTag_itemId_tagId_key" ON "ImageLibraryItemTag"("itemId", "tagId");

-- CreateIndex
CREATE INDEX "ImageLibraryItemTag_itemId_idx" ON "ImageLibraryItemTag"("itemId");

-- CreateIndex
CREATE INDEX "ImageLibraryItemTag_tagId_idx" ON "ImageLibraryItemTag"("tagId");

-- CreateIndex
CREATE INDEX "ImageCollection_createdAt_idx" ON "ImageCollection"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageCollectionItem_collectionId_itemId_key" ON "ImageCollectionItem"("collectionId", "itemId");

-- CreateIndex
CREATE INDEX "ImageCollectionItem_collectionId_sortOrder_idx" ON "ImageCollectionItem"("collectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ImageCollectionItem_itemId_idx" ON "ImageCollectionItem"("itemId");
