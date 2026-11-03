-- Application data is accessed by the server-side Prisma connection only.
-- Keep all application tables inaccessible through Supabase's public Data API.

ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Advertisement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AdvertisementAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MascotMood" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ApplicationSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SocialChannel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SocialPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SocialPostChannel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PublishingAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AdvertisementCaption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PlanningRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ContentPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ContentPlanItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AIUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PdfImport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PdfImportPage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuthThrottle" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name text;
  table_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      FOREACH table_name IN ARRAY ARRAY[
        'User', 'Branch', 'Product', 'Advertisement', 'AdvertisementAsset',
        'MascotMood', 'Template', 'AuditLog', 'ApplicationSetting',
        'SocialChannel', 'SocialPost', 'SocialPostChannel', 'PublishingAttempt',
        'AdvertisementCaption', 'PlanningRule', 'ContentPlan', 'ContentPlanItem',
        'AIUsage', 'PdfImport', 'PdfImportPage', 'AuthSession', 'AuthThrottle'
      ] LOOP
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I',
          'public', table_name, role_name
        );
      END LOOP;
    END IF;
  END LOOP;
END
$$;
