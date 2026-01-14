import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_itineraries_schema_status" ADD VALUE 'warn' BEFORE 'fail';
  ALTER TYPE "public"."enum__itineraries_v_version_schema_status" ADD VALUE 'warn' BEFORE 'fail';
  ALTER TABLE "itineraries" ADD COLUMN "publish_checklist_schema_valid" boolean DEFAULT false;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_publish_checklist_schema_valid" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "itineraries" ALTER COLUMN "schema_status" SET DATA TYPE text;
  ALTER TABLE "itineraries" ALTER COLUMN "schema_status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_itineraries_schema_status";
  CREATE TYPE "public"."enum_itineraries_schema_status" AS ENUM('pending', 'pass', 'fail');
  ALTER TABLE "itineraries" ALTER COLUMN "schema_status" SET DEFAULT 'pending'::"public"."enum_itineraries_schema_status";
  ALTER TABLE "itineraries" ALTER COLUMN "schema_status" SET DATA TYPE "public"."enum_itineraries_schema_status" USING "schema_status"::"public"."enum_itineraries_schema_status";
  ALTER TABLE "_itineraries_v" ALTER COLUMN "version_schema_status" SET DATA TYPE text;
  ALTER TABLE "_itineraries_v" ALTER COLUMN "version_schema_status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum__itineraries_v_version_schema_status";
  CREATE TYPE "public"."enum__itineraries_v_version_schema_status" AS ENUM('pending', 'pass', 'fail');
  ALTER TABLE "_itineraries_v" ALTER COLUMN "version_schema_status" SET DEFAULT 'pending'::"public"."enum__itineraries_v_version_schema_status";
  ALTER TABLE "_itineraries_v" ALTER COLUMN "version_schema_status" SET DATA TYPE "public"."enum__itineraries_v_version_schema_status" USING "version_schema_status"::"public"."enum__itineraries_v_version_schema_status";
  ALTER TABLE "itineraries" DROP COLUMN "publish_checklist_schema_valid";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_publish_checklist_schema_valid";`)
}
