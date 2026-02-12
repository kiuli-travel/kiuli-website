import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Reconciliation migration for Content Engine Phase 1 tables.
 *
 * These tables were manually created via SQL during the deploy-and-rescrape
 * session on 2026-02-11. This migration formalizes them so Payload's migration
 * system is aware of the schema.
 *
 * Uses IF NOT EXISTS throughout — safe to run on both fresh and existing databases.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Content Engine collections — tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "content_projects" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "slug" varchar,
      "status" varchar DEFAULT 'active',
      "description" varchar,
      "config" jsonb DEFAULT '{}'::jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "content_jobs" (
      "id" serial PRIMARY KEY,
      "project_id" integer REFERENCES "content_projects"("id") ON DELETE SET NULL,
      "job_type" varchar NOT NULL,
      "status" varchar DEFAULT 'pending',
      "priority" integer DEFAULT 0,
      "input" jsonb DEFAULT '{}'::jsonb,
      "output" jsonb DEFAULT '{}'::jsonb,
      "error" varchar,
      "started_at" timestamp(3) with time zone,
      "completed_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "source_registry" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "source_type" varchar NOT NULL,
      "url" varchar,
      "config" jsonb DEFAULT '{}'::jsonb,
      "last_checked_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "editorial_directives" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "directive_type" varchar NOT NULL,
      "content" varchar,
      "scope" varchar,
      "config" jsonb DEFAULT '{}'::jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  // Relationship columns in Payload internal tables
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "content_projects_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "content_jobs_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "source_registry_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "editorial_directives_id" integer;

    ALTER TABLE "payload_preferences_rels"
      ADD COLUMN IF NOT EXISTS "content_projects_id" integer;
    ALTER TABLE "payload_preferences_rels"
      ADD COLUMN IF NOT EXISTS "content_jobs_id" integer;
    ALTER TABLE "payload_preferences_rels"
      ADD COLUMN IF NOT EXISTS "source_registry_id" integer;
    ALTER TABLE "payload_preferences_rels"
      ADD COLUMN IF NOT EXISTS "editorial_directives_id" integer;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_content_projects_id_idx"
      ON "payload_locked_documents_rels" ("content_projects_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_content_jobs_id_idx"
      ON "payload_locked_documents_rels" ("content_jobs_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_source_registry_id_idx"
      ON "payload_locked_documents_rels" ("source_registry_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_editorial_directives_id_idx"
      ON "payload_locked_documents_rels" ("editorial_directives_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "content_jobs";
    DROP TABLE IF EXISTS "content_projects";
    DROP TABLE IF EXISTS "source_registry";
    DROP TABLE IF EXISTS "editorial_directives";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "content_projects_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "content_jobs_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "source_registry_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "editorial_directives_id";

    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "content_projects_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "content_jobs_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "source_registry_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "editorial_directives_id";
  `);
}
