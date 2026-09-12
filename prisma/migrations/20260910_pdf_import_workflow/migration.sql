CREATE TABLE "PdfImport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "fileSize" INTEGER NOT NULL,
  "pageCount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IMPORTED',
  "defaultRule" TEXT NOT NULL DEFAULT 'ONE_ADVERT_PER_PAGE',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PdfImport_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PdfImportPage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pdfImportId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_ANALYSIS',
  "rawExtractedText" TEXT NOT NULL DEFAULT '',
  "ocrText" TEXT NOT NULL DEFAULT '',
  "pagePreviewDataUrl" TEXT NOT NULL DEFAULT '',
  "analysisJson" TEXT NOT NULL DEFAULT '{}',
  "selectedImageDataUrl" TEXT NOT NULL DEFAULT '',
  "processedImageDataUrl" TEXT NOT NULL DEFAULT '',
  "backgroundRemovalStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "multiProductDecision" TEXT,
  "userCorrectionsJson" TEXT NOT NULL DEFAULT '{}',
  "pricingTraceJson" TEXT NOT NULL DEFAULT '{}',
  "reviewApprovedAt" DATETIME,
  "reviewApprovedByUserId" TEXT,
  "advertisementId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PdfImportPage_pdfImportId_fkey" FOREIGN KEY ("pdfImportId") REFERENCES "PdfImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PdfImport_createdByUserId_createdAt_idx" ON "PdfImport"("createdByUserId", "createdAt");
CREATE INDEX "PdfImport_status_idx" ON "PdfImport"("status");
CREATE UNIQUE INDEX "PdfImportPage_pdfImportId_pageNumber_key" ON "PdfImportPage"("pdfImportId", "pageNumber");
CREATE INDEX "PdfImportPage_status_idx" ON "PdfImportPage"("status");
CREATE INDEX "PdfImportPage_advertisementId_idx" ON "PdfImportPage"("advertisementId");
