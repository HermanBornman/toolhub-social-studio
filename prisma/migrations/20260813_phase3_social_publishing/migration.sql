ALTER TABLE "AuditLog" ADD COLUMN "socialPostId" TEXT;

CREATE TABLE "ApplicationSetting" (
  "id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL, "value" TEXT NOT NULL,
  "updatedBy" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ApplicationSetting_key_key" ON "ApplicationSetting"("key");

CREATE TABLE "SocialChannel" (
  "id" TEXT NOT NULL PRIMARY KEY, "provider" TEXT NOT NULL DEFAULT 'BUFFER', "providerChannelId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL, "service" TEXT NOT NULL, "name" TEXT NOT NULL, "displayName" TEXT,
  "connectedStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "active" BOOLEAN NOT NULL DEFAULT true,
  "publishingEnabled" BOOLEAN NOT NULL DEFAULT false, "metadata" TEXT, "lastSyncedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "SocialChannel_providerChannelId_key" ON "SocialChannel"("providerChannelId");
CREATE INDEX "SocialChannel_organizationId_idx" ON "SocialChannel"("organizationId");
CREATE INDEX "SocialChannel_service_idx" ON "SocialChannel"("service");
CREATE INDEX "SocialChannel_active_publishingEnabled_idx" ON "SocialChannel"("active", "publishingEnabled");

CREATE TABLE "SocialPost" (
  "id" TEXT NOT NULL PRIMARY KEY, "idempotencyKey" TEXT NOT NULL, "advertisementId" TEXT NOT NULL,
  "caption" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "mode" TEXT NOT NULL DEFAULT 'SCHEDULE',
  "scheduledAt" DATETIME, "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg', "finalArtworkUrl" TEXT NOT NULL,
  "finalArtworkData" TEXT, "finalArtworkCreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dryRun" BOOLEAN NOT NULL DEFAULT true, "createdByUserId" TEXT NOT NULL, "publishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SocialPost_advertisementId_fkey" FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SocialPost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SocialPost_idempotencyKey_key" ON "SocialPost"("idempotencyKey");
CREATE INDEX "SocialPost_advertisementId_idx" ON "SocialPost"("advertisementId");
CREATE INDEX "SocialPost_status_idx" ON "SocialPost"("status");
CREATE INDEX "SocialPost_scheduledAt_idx" ON "SocialPost"("scheduledAt");

CREATE TABLE "SocialPostChannel" (
  "id" TEXT NOT NULL PRIMARY KEY, "socialPostId" TEXT NOT NULL, "socialChannelId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY', "providerPostId" TEXT, "providerStatus" TEXT, "providerDueAt" DATETIME,
  "providerResponse" TEXT, "errorCode" TEXT, "errorMessage" TEXT, "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "intendedSchedule" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SocialPostChannel_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SocialPostChannel_socialChannelId_fkey" FOREIGN KEY ("socialChannelId") REFERENCES "SocialChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SocialPostChannel_socialPostId_socialChannelId_intendedSchedule_key" ON "SocialPostChannel"("socialPostId", "socialChannelId", "intendedSchedule");
CREATE INDEX "SocialPostChannel_status_idx" ON "SocialPostChannel"("status");

CREATE TABLE "PublishingAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY, "socialPostId" TEXT NOT NULL, "socialPostChannelId" TEXT NOT NULL, "channelId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL, "action" TEXT NOT NULL, "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME, "success" BOOLEAN, "provider" TEXT NOT NULL DEFAULT 'BUFFER', "providerPostId" TEXT,
  "errorCode" TEXT, "errorMessage" TEXT, "responseMetadata" TEXT,
  CONSTRAINT "PublishingAttempt_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PublishingAttempt_socialPostChannelId_fkey" FOREIGN KEY ("socialPostChannelId") REFERENCES "SocialPostChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PublishingAttempt_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "SocialChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PublishingAttempt_socialPostId_requestedAt_idx" ON "PublishingAttempt"("socialPostId", "requestedAt");
CREATE INDEX "PublishingAttempt_socialPostChannelId_attemptNumber_idx" ON "PublishingAttempt"("socialPostChannelId", "attemptNumber");
CREATE INDEX "AuditLog_socialPostId_createdAt_idx" ON "AuditLog"("socialPostId", "createdAt");
