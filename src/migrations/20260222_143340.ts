import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_content_projects_quality_gates_result" AS ENUM('pass', 'fail', 'not_checked');
  CREATE TYPE "public"."enum__content_projects_v_version_quality_gates_result" AS ENUM('pass', 'fail', 'not_checked');
  ALTER TABLE "content_projects" ADD COLUMN "quality_gates_result" "enum_content_projects_quality_gates_result" DEFAULT 'not_checked';
  ALTER TABLE "content_projects" ADD COLUMN "quality_gates_violations" jsonb;
  ALTER TABLE "content_projects" ADD COLUMN "quality_gates_checked_at" timestamp(3) with time zone;
  ALTER TABLE "content_projects" ADD COLUMN "quality_gates_overridden" boolean DEFAULT false;
  ALTER TABLE "content_projects" ADD COLUMN "quality_gates_override_note" varchar;
  ALTER TABLE "_content_projects_v" ADD COLUMN "version_quality_gates_result" "enum__content_projects_v_version_quality_gates_result" DEFAULT 'not_checked';
  ALTER TABLE "_content_projects_v" ADD COLUMN "version_quality_gates_violations" jsonb;
  ALTER TABLE "_content_projects_v" ADD COLUMN "version_quality_gates_checked_at" timestamp(3) with time zone;
  ALTER TABLE "_content_projects_v" ADD COLUMN "version_quality_gates_overridden" boolean DEFAULT false;
  ALTER TABLE "_content_projects_v" ADD COLUMN "version_quality_gates_override_note" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "content_projects" DROP COLUMN "quality_gates_result";
  ALTER TABLE "content_projects" DROP COLUMN "quality_gates_violations";
  ALTER TABLE "content_projects" DROP COLUMN "quality_gates_checked_at";
  ALTER TABLE "content_projects" DROP COLUMN "quality_gates_overridden";
  ALTER TABLE "content_projects" DROP COLUMN "quality_gates_override_note";
  ALTER TABLE "_content_projects_v" DROP COLUMN "version_quality_gates_result";
  ALTER TABLE "_content_projects_v" DROP COLUMN "version_quality_gates_violations";
  ALTER TABLE "_content_projects_v" DROP COLUMN "version_quality_gates_checked_at";
  ALTER TABLE "_content_projects_v" DROP COLUMN "version_quality_gates_overridden";
  ALTER TABLE "_content_projects_v" DROP COLUMN "version_quality_gates_override_note";
  DROP TYPE "public"."enum_content_projects_quality_gates_result";
  DROP TYPE "public"."enum__content_projects_v_version_quality_gates_result";`)
}
