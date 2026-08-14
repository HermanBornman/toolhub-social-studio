ALTER TABLE "Advertisement" ADD COLUMN "planningPriority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Advertisement" ADD COLUMN "planningTags" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Advertisement" ADD COLUMN "validFrom" DATETIME;
ALTER TABLE "Advertisement" ADD COLUMN "validUntil" DATETIME;

CREATE TABLE "AdvertisementCaption" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AdvertisementCaption_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdvertisementCaption_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AdvertisementCaption_advertisementId_createdAt_idx" ON "AdvertisementCaption"("advertisementId", "createdAt");
CREATE INDEX "AdvertisementCaption_state_idx" ON "AdvertisementCaption"("state");

CREATE TABLE "PlanningRule" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
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
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ContentPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "weekStart" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNING_DRAFT',
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
  "channels" TEXT NOT NULL DEFAULT '[]',
  "notes" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "submittedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "submittedAt" DATETIME,
  "approvedAt" DATETIME,
  "activatedAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ContentPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContentPlan_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ContentPlan_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ContentPlan_weekStart_status_idx" ON "ContentPlan"("weekStart", "status");
CREATE INDEX "ContentPlan_createdByUserId_idx" ON "ContentPlan"("createdByUserId");

CREATE TABLE "ContentPlanItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contentPlanId" TEXT NOT NULL,
  "advertisementId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "plannedAt" DATETIME NOT NULL,
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
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ContentPlanItem_contentPlanId_fkey" FOREIGN KEY ("contentPlanId") REFERENCES "ContentPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentPlanItem_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContentPlanItem_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SocialChannel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContentPlanItem_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ContentPlanItem_contentPlanId_channelId_plannedAt_key" ON "ContentPlanItem"("contentPlanId", "channelId", "plannedAt");
CREATE INDEX "ContentPlanItem_advertisementId_plannedAt_idx" ON "ContentPlanItem"("advertisementId", "plannedAt");
CREATE INDEX "ContentPlanItem_status_idx" ON "ContentPlanItem"("status");

CREATE TABLE "AIUsage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "estimatedCost" REAL,
  "metadata" TEXT,
  "userId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AIUsage_action_createdAt_idx" ON "AIUsage"("action", "createdAt");
CREATE INDEX "AIUsage_entityType_entityId_idx" ON "AIUsage"("entityType", "entityId");
