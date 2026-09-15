CREATE TABLE "Branch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

ALTER TABLE "User" ADD COLUMN "branchId" TEXT REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_branchId_idx" ON "User"("branchId");

ALTER TABLE "Advertisement" ADD COLUMN "branchId" TEXT REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Advertisement" ADD COLUMN "branchName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Advertisement" ADD COLUMN "finalizedAt" DATETIME;
ALTER TABLE "Advertisement" ADD COLUMN "finalizedByUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Advertisement" ADD COLUMN "finalArtworkData" TEXT;
ALTER TABLE "Advertisement" ADD COLUMN "finalArtworkMimeType" TEXT;
ALTER TABLE "Advertisement" ADD COLUMN "finalArtworkWidth" INTEGER;
ALTER TABLE "Advertisement" ADD COLUMN "finalArtworkHeight" INTEGER;
ALTER TABLE "Advertisement" ADD COLUMN "finalVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Advertisement" ADD COLUMN "archivedAt" DATETIME;
CREATE INDEX "Advertisement_branchId_idx" ON "Advertisement"("branchId");
CREATE INDEX "Advertisement_finalizedAt_idx" ON "Advertisement"("finalizedAt");

UPDATE "User" SET "role" = 'STORE_MANAGER' WHERE "role" = 'STAFF';

INSERT INTO "Branch" ("id", "code", "name", "active", "createdAt", "updatedAt") VALUES
  ('branch-polokwane-crossing', 'POLOKWANE_CROSSING', 'Toolhub Polokwane Crossing', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('branch-stonewood', 'STONEWOOD', 'Toolhub Stonewood', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('branch-yzerfontein', 'YZERFONTEIN', 'Toolhub Yzerfontein', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Existing users and adverts remain unassigned when no trusted exact branch mapping exists.
-- Admin branch assignment required before user can create/finalize branch-scoped adverts.
