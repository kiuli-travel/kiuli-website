import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix posts_faq_items and related table ID column types.
 *
 * Payload CMS 3.76 uses different ID strategies for main vs version array tables:
 * - Main tables (posts_faq_items, posts_populated_authors): varchar IDs (hex strings provided by Payload)
 * - Version tables (_posts_v_version_faq_items, _posts_v_version_populated_authors): serial IDs (auto-increment)
 *
 * The original migration (20260208) incorrectly created posts_faq_items.id as serial.
 * This was then changed to varchar via ALTER TABLE, but the version tables were also
 * incorrectly changed to varchar, breaking version creation (silent transaction rollback).
 *
 * This migration ensures the correct types match Payload's Drizzle schema expectations.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Main table: posts_faq_items.id should be varchar (Payload provides hex string IDs)
  await db.execute(sql`
    ALTER TABLE "posts_faq_items" ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "posts_faq_items" ALTER COLUMN "id" SET DATA TYPE varchar USING "id"::varchar;
  `)
  await db.execute(sql`
    DROP SEQUENCE IF EXISTS "posts_faq_items_id_seq";
  `)

  // Version table: _posts_v_version_faq_items.id should be serial (integer + auto-increment)
  await db.execute(sql`
    ALTER TABLE "_posts_v_version_faq_items" ALTER COLUMN "id" SET DATA TYPE integer USING 0;
  `)
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS "_posts_v_version_faq_items_id_seq" OWNED BY "_posts_v_version_faq_items"."id";
  `)
  await db.execute(sql`
    SELECT setval('"_posts_v_version_faq_items_id_seq"', COALESCE((SELECT MAX("id") FROM "_posts_v_version_faq_items"), 0) + 1, false);
  `)
  await db.execute(sql`
    ALTER TABLE "_posts_v_version_faq_items" ALTER COLUMN "id" SET DEFAULT nextval('"_posts_v_version_faq_items_id_seq"');
  `)

  // Version table: _posts_v_version_populated_authors.id should be serial
  await db.execute(sql`
    ALTER TABLE "_posts_v_version_populated_authors" ALTER COLUMN "id" SET DATA TYPE integer USING 0;
  `)
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS "_posts_v_version_populated_authors_id_seq" OWNED BY "_posts_v_version_populated_authors"."id";
  `)
  await db.execute(sql`
    SELECT setval('"_posts_v_version_populated_authors_id_seq"', COALESCE((SELECT MAX("id") FROM "_posts_v_version_populated_authors"), 0) + 1, false);
  `)
  await db.execute(sql`
    ALTER TABLE "_posts_v_version_populated_authors" ALTER COLUMN "id" SET DEFAULT nextval('"_posts_v_version_populated_authors_id_seq"');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Revert posts_faq_items.id back to serial
  await db.execute(sql`
    ALTER TABLE "posts_faq_items" ALTER COLUMN "id" SET DATA TYPE integer USING "id"::integer;
  `)
  await db.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS "posts_faq_items_id_seq" OWNED BY "posts_faq_items"."id";
  `)
  await db.execute(sql`
    ALTER TABLE "posts_faq_items" ALTER COLUMN "id" SET DEFAULT nextval('"posts_faq_items_id_seq"');
  `)

  // Revert version tables back to varchar
  await db.execute(sql`
    ALTER TABLE "_posts_v_version_faq_items" ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "_posts_v_version_faq_items" ALTER COLUMN "id" SET DATA TYPE varchar USING "id"::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_posts_v_version_populated_authors" ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "_posts_v_version_populated_authors" ALTER COLUMN "id" SET DATA TYPE varchar USING "id"::varchar;
  `)
}
