-- Additive Phase 1 authentication fields. Existing identities remain unchanged.
ALTER TABLE "User" ADD COLUMN "mobileNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "mobileE164" TEXT;
CREATE UNIQUE INDEX "User_mobileE164_key" ON "User"("mobileE164");

ALTER TABLE "AuthSession" ADD COLUMN "remembered" BOOLEAN NOT NULL DEFAULT false;

-- Existing users are intentionally not assigned guessed phone numbers.
-- Admin assignment is required before a Store Manager can authenticate by SMS OTP.
