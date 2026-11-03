-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."User" (
    "authProvider" TEXT,
    "authProviderUserId" TEXT,
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobileNumber" TEXT,
    "mobileE164" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STORE_MANAGER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Advertisement" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "createdByUserId" TEXT NOT NULL DEFAULT 'dev-staff-1',
    "lastEditedByUserId" TEXT NOT NULL DEFAULT 'dev-staff-1',
    "branchId" TEXT,
    "branchName" TEXT NOT NULL DEFAULT '',
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "primarySpecification" TEXT NOT NULL,
    "secondarySpecification" TEXT,
    "feature01" TEXT,
    "feature02" TEXT,
    "keyBenefit" TEXT,
    "campaignType" TEXT NOT NULL,
    "campaignMessage" TEXT NOT NULL,
    "powerInclusionJson" TEXT NOT NULL DEFAULT '{}',
    "pricingMethod" TEXT NOT NULL DEFAULT 'PDF',
    "wasPrice" INTEGER,
    "nowPrice" INTEGER,
    "pricingAuditJson" TEXT NOT NULL DEFAULT '{}',
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
    "submittedAt" TIMESTAMP(3),
    "submittedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "approvalComment" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "finalArtworkData" TEXT,
    "finalArtworkMimeType" TEXT,
    "finalArtworkWidth" INTEGER,
    "finalArtworkHeight" INTEGER,
    "finalVersion" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "templateId" TEXT,
    "planningPriority" TEXT NOT NULL DEFAULT 'NORMAL',
    "planningTags" TEXT NOT NULL DEFAULT '',
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdvertisementAsset" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisementAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MascotMood" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "assetPath" TEXT NOT NULL,
    "thumbnailPath" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "xPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MascotMood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Template" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "advertisementId" TEXT,
    "socialPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApplicationSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialChannel" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'BUFFER',
    "providerChannelId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "connectedStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "publishingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialPost" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "mode" TEXT NOT NULL DEFAULT 'SCHEDULE',
    "scheduledAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    "finalArtworkUrl" TEXT NOT NULL,
    "finalArtworkData" TEXT,
    "finalArtworkCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialPostChannel" (
    "id" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "socialChannelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "providerPostId" TEXT,
    "providerStatus" TEXT,
    "providerDueAt" TIMESTAMP(3),
    "providerResponse" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "intendedSchedule" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPostChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PublishingAttempt" (
    "id" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "socialPostChannelId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "success" BOOLEAN,
    "provider" TEXT NOT NULL DEFAULT 'BUFFER',
    "providerPostId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "responseMetadata" TEXT,

    CONSTRAINT "PublishingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdvertisementCaption" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "masterCaption" TEXT NOT NULL,
    "facebookCaption" TEXT,
    "instagramCaption" TEXT,
    "useSameCaption" BOOLEAN NOT NULL DEFAULT true,
    "tone" TEXT NOT NULL DEFAULT 'Professional',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "validationWarnings" TEXT NOT NULL DEFAULT '[]',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisementCaption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanningRule" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    "facebookPostsPerWeek" INTEGER NOT NULL DEFAULT 5,
    "instagramPostsPerWeek" INTEGER NOT NULL DEFAULT 5,
    "preferredDays" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    "preferredTime" TEXT NOT NULL DEFAULT '09:00',
    "sameSkuCooldownDays" INTEGER NOT NULL DEFAULT 14,
    "sameAdvertCooldownDays" INTEGER NOT NULL DEFAULT 14,
    "maxSpecialsPerWeek" INTEGER NOT NULL DEFAULT 2,
    "maxBackInStockPerWeek" INTEGER NOT NULL DEFAULT 2,
    "categoryBalancing" BOOLEAN NOT NULL DEFAULT true,
    "campaignBalancing" BOOLEAN NOT NULL DEFAULT true,
    "autoSchedulingMode" TEXT NOT NULL DEFAULT 'manual',
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContentPlan" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING_DRAFT',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    "channels" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContentPlanItem" (
    "id" TEXT NOT NULL,
    "contentPlanId" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL,
    "masterCaption" TEXT NOT NULL,
    "facebookCaption" TEXT,
    "instagramCaption" TEXT,
    "useSameCaption" BOOLEAN NOT NULL DEFAULT true,
    "captionSource" TEXT NOT NULL DEFAULT 'TEMPLATE',
    "captionState" TEXT NOT NULL DEFAULT 'DRAFT',
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "reason" TEXT NOT NULL,
    "warnings" TEXT NOT NULL DEFAULT '[]',
    "manualPinned" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "socialPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIUsage" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "metadata" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PdfImport" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileSize" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IMPORTED',
    "defaultRule" TEXT NOT NULL DEFAULT 'ONE_ADVERT_PER_PAGE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PdfImportPage" (
    "id" TEXT NOT NULL,
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
    "extractedPricingJson" TEXT NOT NULL DEFAULT '{}',
    "pricingJson" TEXT NOT NULL DEFAULT '{}',
    "priceConfirmedByUserId" TEXT,
    "priceConfirmedAt" TIMESTAMP(3),
    "reviewApprovedAt" TIMESTAMP(3),
    "reviewApprovedByUserId" TEXT,
    "advertisementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfImportPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerTokens" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'APP',
    "remembered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuthThrottle" (
    "id" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_mobileE164_key" ON "public"."User"("mobileE164");

-- CreateIndex
CREATE INDEX "User_branchId_idx" ON "public"."User"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProvider_authProviderUserId_key" ON "public"."User"("authProvider", "authProviderUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "public"."Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "public"."Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "public"."Product"("sku");

-- CreateIndex
CREATE INDEX "Product_productName_idx" ON "public"."Product"("productName");

-- CreateIndex
CREATE INDEX "Product_barcode_idx" ON "public"."Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "public"."Product"("brand");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "public"."Product"("category");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "public"."Product"("active");

-- CreateIndex
CREATE INDEX "Advertisement_status_idx" ON "public"."Advertisement"("status");

-- CreateIndex
CREATE INDEX "Advertisement_createdByUserId_idx" ON "public"."Advertisement"("createdByUserId");

-- CreateIndex
CREATE INDEX "Advertisement_branchId_idx" ON "public"."Advertisement"("branchId");

-- CreateIndex
CREATE INDEX "Advertisement_finalizedAt_idx" ON "public"."Advertisement"("finalizedAt");

-- CreateIndex
CREATE INDEX "Advertisement_submittedAt_idx" ON "public"."Advertisement"("submittedAt");

-- CreateIndex
CREATE INDEX "Advertisement_createdAt_idx" ON "public"."Advertisement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Template_version_key" ON "public"."Template"("version");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_advertisementId_createdAt_idx" ON "public"."AuditLog"("advertisementId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_socialPostId_createdAt_idx" ON "public"."AuditLog"("socialPostId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationSetting_key_key" ON "public"."ApplicationSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SocialChannel_providerChannelId_key" ON "public"."SocialChannel"("providerChannelId");

-- CreateIndex
CREATE INDEX "SocialChannel_organizationId_idx" ON "public"."SocialChannel"("organizationId");

-- CreateIndex
CREATE INDEX "SocialChannel_service_idx" ON "public"."SocialChannel"("service");

-- CreateIndex
CREATE INDEX "SocialChannel_active_publishingEnabled_idx" ON "public"."SocialChannel"("active", "publishingEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_idempotencyKey_key" ON "public"."SocialPost"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SocialPost_advertisementId_idx" ON "public"."SocialPost"("advertisementId");

-- CreateIndex
CREATE INDEX "SocialPost_status_idx" ON "public"."SocialPost"("status");

-- CreateIndex
CREATE INDEX "SocialPost_scheduledAt_idx" ON "public"."SocialPost"("scheduledAt");

-- CreateIndex
CREATE INDEX "SocialPostChannel_status_idx" ON "public"."SocialPostChannel"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPostChannel_socialPostId_socialChannelId_intendedSche_key" ON "public"."SocialPostChannel"("socialPostId", "socialChannelId", "intendedSchedule");

-- CreateIndex
CREATE INDEX "PublishingAttempt_socialPostId_requestedAt_idx" ON "public"."PublishingAttempt"("socialPostId", "requestedAt");

-- CreateIndex
CREATE INDEX "PublishingAttempt_socialPostChannelId_attemptNumber_idx" ON "public"."PublishingAttempt"("socialPostChannelId", "attemptNumber");

-- CreateIndex
CREATE INDEX "AdvertisementCaption_advertisementId_createdAt_idx" ON "public"."AdvertisementCaption"("advertisementId", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertisementCaption_state_idx" ON "public"."AdvertisementCaption"("state");

-- CreateIndex
CREATE INDEX "ContentPlan_weekStart_status_idx" ON "public"."ContentPlan"("weekStart", "status");

-- CreateIndex
CREATE INDEX "ContentPlan_createdByUserId_idx" ON "public"."ContentPlan"("createdByUserId");

-- CreateIndex
CREATE INDEX "ContentPlanItem_advertisementId_plannedAt_idx" ON "public"."ContentPlanItem"("advertisementId", "plannedAt");

-- CreateIndex
CREATE INDEX "ContentPlanItem_status_idx" ON "public"."ContentPlanItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPlanItem_contentPlanId_channelId_plannedAt_key" ON "public"."ContentPlanItem"("contentPlanId", "channelId", "plannedAt");

-- CreateIndex
CREATE INDEX "AIUsage_action_createdAt_idx" ON "public"."AIUsage"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsage_entityType_entityId_idx" ON "public"."AIUsage"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "PdfImport_createdByUserId_createdAt_idx" ON "public"."PdfImport"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "PdfImport_status_idx" ON "public"."PdfImport"("status");

-- CreateIndex
CREATE INDEX "PdfImportPage_status_idx" ON "public"."PdfImportPage"("status");

-- CreateIndex
CREATE INDEX "PdfImportPage_advertisementId_idx" ON "public"."PdfImportPage"("advertisementId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfImportPage_pdfImportId_pageNumber_key" ON "public"."PdfImportPage"("pdfImportId", "pageNumber");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "public"."AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "public"."AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthThrottle_expiresAt_idx" ON "public"."AuthThrottle"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Advertisement" ADD CONSTRAINT "Advertisement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Advertisement" ADD CONSTRAINT "Advertisement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Advertisement" ADD CONSTRAINT "Advertisement_lastEditedByUserId_fkey" FOREIGN KEY ("lastEditedByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Advertisement" ADD CONSTRAINT "Advertisement_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Advertisement" ADD CONSTRAINT "Advertisement_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Advertisement" ADD CONSTRAINT "Advertisement_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Advertisement" ADD CONSTRAINT "Advertisement_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Advertisement" ADD CONSTRAINT "Advertisement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Advertisement" ADD CONSTRAINT "Advertisement_moodId_fkey" FOREIGN KEY ("moodId") REFERENCES "public"."MascotMood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Advertisement" ADD CONSTRAINT "Advertisement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdvertisementAsset" ADD CONSTRAINT "AdvertisementAsset_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "public"."Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "public"."Advertisement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "public"."SocialPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPost" ADD CONSTRAINT "SocialPost_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "public"."Advertisement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPost" ADD CONSTRAINT "SocialPost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPostChannel" ADD CONSTRAINT "SocialPostChannel_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPostChannel" ADD CONSTRAINT "SocialPostChannel_socialChannelId_fkey" FOREIGN KEY ("socialChannelId") REFERENCES "public"."SocialChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublishingAttempt" ADD CONSTRAINT "PublishingAttempt_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublishingAttempt" ADD CONSTRAINT "PublishingAttempt_socialPostChannelId_fkey" FOREIGN KEY ("socialPostChannelId") REFERENCES "public"."SocialPostChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PublishingAttempt" ADD CONSTRAINT "PublishingAttempt_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."SocialChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdvertisementCaption" ADD CONSTRAINT "AdvertisementCaption_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "public"."Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdvertisementCaption" ADD CONSTRAINT "AdvertisementCaption_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentPlan" ADD CONSTRAINT "ContentPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentPlan" ADD CONSTRAINT "ContentPlan_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentPlan" ADD CONSTRAINT "ContentPlan_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_contentPlanId_fkey" FOREIGN KEY ("contentPlanId") REFERENCES "public"."ContentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "public"."Advertisement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."SocialChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "public"."SocialPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PdfImport" ADD CONSTRAINT "PdfImport_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PdfImportPage" ADD CONSTRAINT "PdfImportPage_pdfImportId_fkey" FOREIGN KEY ("pdfImportId") REFERENCES "public"."PdfImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
