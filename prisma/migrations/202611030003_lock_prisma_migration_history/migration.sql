-- Keep Prisma's internal migration history out of the exposed Data API roles.
-- The table owner/migration role retains access; RLS is deliberately not forced.
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "public"."_prisma_migrations" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "public"."_prisma_migrations" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE "public"."_prisma_migrations" FROM authenticated;
