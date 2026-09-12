-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "primarySpecification" TEXT NOT NULL,
    "secondarySpecification" TEXT,
    "feature01" TEXT,
    "feature02" TEXT,
    "keyBenefit" TEXT,
    "imagePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "primarySpecification" TEXT NOT NULL,
    "secondarySpecification" TEXT,
    "feature01" TEXT,
    "feature02" TEXT,
    "keyBenefit" TEXT,
    "campaignType" TEXT NOT NULL,
    "campaignMessage" TEXT NOT NULL,
    "sellingPrice" INTEGER NOT NULL,
    "disclaimer" TEXT NOT NULL DEFAULT 'WHILE STOCKS LAST',
    "moodId" TEXT NOT NULL,
    "productImage" TEXT NOT NULL,
    "originalImageUrl" TEXT NOT NULL DEFAULT '',
    "processedImageUrl" TEXT,
    "backgroundRemovalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "useOriginalImage" BOOLEAN NOT NULL DEFAULT false,
    "qrUrl" TEXT NOT NULL DEFAULT 'https://www.toolhub.co.za',
    "templateVersion" TEXT NOT NULL DEFAULT 'TOOLHUB_SOCIAL_MASTER_V1',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT,
    "productId" TEXT,
    "templateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Advertisement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_moodId_fkey" FOREIGN KEY ("moodId") REFERENCES "MascotMood" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdvertisementAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "advertisementId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvertisementAsset_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MascotMood" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "assetPath" TEXT NOT NULL,
    "thumbnailPath" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultScale" REAL NOT NULL DEFAULT 1,
    "xPosition" REAL NOT NULL DEFAULT 0,
    "yPosition" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" TEXT,
    "userId" TEXT,
    "advertisementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Advertisement_status_idx" ON "Advertisement"("status");

-- CreateIndex
CREATE INDEX "Advertisement_createdAt_idx" ON "Advertisement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Template_version_key" ON "Template"("version");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

