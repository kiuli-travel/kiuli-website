import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration to add missing columns to payload_locked_documents_rels table.
 *
 * Root cause: When Authors and Properties collections were added, Payload CMS
 * needs corresponding columns in the locked_documents_rels table to track
 * document locks. These columns were missing, causing the admin dashboard
 * to fail with "column authors_id does not exist" error.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "authors_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "properties_id" integer;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_authors_id_idx"
      ON "payload_locked_documents_rels" ("authors_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_properties_id_idx"
      ON "payload_locked_documents_rels" ("properties_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_authors_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_properties_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "authors_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "properties_id";
  `)
}
