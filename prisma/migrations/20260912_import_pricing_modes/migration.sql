ALTER TABLE "Advertisement" ADD COLUMN "pricingMethod" TEXT NOT NULL DEFAULT 'PDF';
ALTER TABLE "Advertisement" ADD COLUMN "wasPrice" INTEGER;
ALTER TABLE "Advertisement" ADD COLUMN "nowPrice" INTEGER;
ALTER TABLE "Advertisement" ADD COLUMN "pricingAuditJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "PdfImportPage" ADD COLUMN "extractedPricingJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "PdfImportPage" ADD COLUMN "pricingJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "PdfImportPage" ADD COLUMN "priceConfirmedByUserId" TEXT;
ALTER TABLE "PdfImportPage" ADD COLUMN "priceConfirmedAt" DATETIME;
UPDATE "PdfImportPage" SET "extractedPricingJson" = json_object('nettPrice', json_extract("analysisJson", '$.nettPrice'), 'sellingPrice', json_extract("analysisJson", '$.promotionalPrice'))
WHERE json_type("analysisJson", '$.nettPrice') = 'object' AND json_type("analysisJson", '$.promotionalPrice') = 'object';
