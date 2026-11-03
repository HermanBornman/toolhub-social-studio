-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "newStatus" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "previousStatus" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "userName" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Advertisement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT,
    "createdByUserId" TEXT NOT NULL DEFAULT 'dev-staff-1',
    "lastEditedByUserId" TEXT NOT NULL DEFAULT 'dev-staff-1',
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
    "submittedAt" DATETIME,
    "submittedByUserId" TEXT,
    "approvedAt" DATETIME,
    "approvedByUserId" TEXT,
    "rejectedAt" DATETIME,
    "rejectedByUserId" TEXT,
    "approvalComment" TEXT,
    "templateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Advertisement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_lastEditedByUserId_fkey" FOREIGN KEY ("lastEditedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_moodId_fkey" FOREIGN KEY ("moodId") REFERENCES "MascotMood" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Advertisement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Advertisement" ("backgroundRemovalStatus", "campaignMessage", "campaignType", "createdAt", "disclaimer", "feature01", "feature02", "id", "keyBenefit", "moodId", "originalImageUrl", "primarySpecification", "processedImageUrl", "productId", "productImage", "productName", "qrUrl", "secondarySpecification", "sellingPrice", "sku", "status", "templateId", "templateVersion", "updatedAt", "useOriginalImage") SELECT "backgroundRemovalStatus", "campaignMessage", "campaignType", "createdAt", "disclaimer", "feature01", "feature02", "id", "keyBenefit", "moodId", "originalImageUrl", "primarySpecification", "processedImageUrl", "productId", "productImage", "productName", "qrUrl", "secondarySpecification", "sellingPrice", "sku", "status", "templateId", "templateVersion", "updatedAt", "useOriginalImage" FROM "Advertisement";
DROP TABLE "Advertisement";
ALTER TABLE "new_Advertisement" RENAME TO "Advertisement";
CREATE INDEX "Advertisement_status_idx" ON "Advertisement"("status");
CREATE INDEX "Advertisement_createdByUserId_idx" ON "Advertisement"("createdByUserId");
CREATE INDEX "Advertisement_submittedAt_idx" ON "Advertisement"("submittedAt");
CREATE INDEX "Advertisement_createdAt_idx" ON "Advertisement"("createdAt");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "brand" TEXT NOT NULL DEFAULT 'INGCO',
    "productName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Tools',
    "primarySpecification" TEXT NOT NULL,
    "secondarySpecification" TEXT,
    "feature01" TEXT,
    "feature02" TEXT,
    "keyBenefit" TEXT,
    "normalPrice" INTEGER,
    "currentPrice" INTEGER NOT NULL,
    "websiteUrl" TEXT,
    "originalImageUrl" TEXT NOT NULL DEFAULT '',
    "processedImageUrl" TEXT,
    "backgroundRemovalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Preserve every Phase 1 product. Phase 1 had no price column, so legacy rows
-- receive a visible placeholder value that staff can correct in Product Edit.
INSERT INTO "new_Product" ("createdAt", "feature01", "feature02", "id", "keyBenefit", "primarySpecification", "secondarySpecification", "sku", "updatedAt", "productName", "currentPrice", "originalImageUrl") SELECT "createdAt", "feature01", "feature02", "id", "keyBenefit", "primarySpecification", "secondarySpecification", "sku", "updatedAt", "name", 1, COALESCE("imagePath", '') FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_productName_idx" ON "Product"("productName");
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
CREATE INDEX "Product_brand_idx" ON "Product"("brand");
CREATE INDEX "Product_category_idx" ON "Product"("category");
CREATE INDEX "Product_active_idx" ON "Product"("active");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_advertisementId_createdAt_idx" ON "AuditLog"("advertisementId", "createdAt");
