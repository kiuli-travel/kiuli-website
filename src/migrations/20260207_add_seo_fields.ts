import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration to add SEO fields to itineraries collection
 *
 * Adding:
 * - canonicalUrl (text)
 * - answerCapsule (text)
 * - focusKeyword (text)
 * - lastModified (timestamp)
 * - relatedItineraries (relationship via _rels table)
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add new columns to itineraries table
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "canonical_url" varchar,
    ADD COLUMN IF NOT EXISTS "answer_capsule" varchar,
    ADD COLUMN IF NOT EXISTS "focus_keyword" varchar,
    ADD COLUMN IF NOT EXISTS "last_modified" timestamp(3) with time zone;
  `)

  // Add new columns to versioned itineraries table
  await db.execute(sql`
    ALTER TABLE "_itineraries_v"
    ADD COLUMN IF NOT EXISTS "version_canonical_url" varchar,
    ADD COLUMN IF NOT EXISTS "version_answer_capsule" varchar,
    ADD COLUMN IF NOT EXISTS "version_focus_keyword" varchar,
    ADD COLUMN IF NOT EXISTS "version_last_modified" timestamp(3) with time zone;
  `)

  // Add self-referential relationship column to _rels table
  await db.execute(sql`
    ALTER TABLE "itineraries_rels"
    ADD COLUMN IF NOT EXISTS "itineraries_id" integer;
  `)

  // Add foreign key constraint
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'itineraries_rels_itineraries_fk'
      ) THEN
        ALTER TABLE "itineraries_rels"
        ADD CONSTRAINT "itineraries_rels_itineraries_fk"
        FOREIGN KEY ("itineraries_id") REFERENCES "itineraries"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // Add index for the relationship
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "itineraries_rels_itineraries_id_idx"
    ON "itineraries_rels" ("itineraries_id");
  `)

  // Add to versioned rels table as well
  await db.execute(sql`
    ALTER TABLE "_itineraries_v_rels"
    ADD COLUMN IF NOT EXISTS "itineraries_id" integer;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Remove columns from itineraries table
  await db.execute(sql`
    ALTER TABLE "itineraries"
    DROP COLUMN IF EXISTS "canonical_url",
    DROP COLUMN IF EXISTS "answer_capsule",
    DROP COLUMN IF EXISTS "focus_keyword",
    DROP COLUMN IF EXISTS "last_modified";
  `)

  // Remove from versioned table
  await db.execute(sql`
    ALTER TABLE "_itineraries_v"
    DROP COLUMN IF EXISTS "version_canonical_url",
    DROP COLUMN IF EXISTS "version_answer_capsule",
    DROP COLUMN IF EXISTS "version_focus_keyword",
    DROP COLUMN IF EXISTS "version_last_modified";
  `)

  // Drop index and foreign key
  await db.execute(sql`
    DROP INDEX IF EXISTS "itineraries_rels_itineraries_id_idx";
  `)

  await db.execute(sql`
    ALTER TABLE "itineraries_rels"
    DROP CONSTRAINT IF EXISTS "itineraries_rels_itineraries_fk";
  `)

  // Remove relationship column
  await db.execute(sql`
    ALTER TABLE "itineraries_rels"
    DROP COLUMN IF EXISTS "itineraries_id";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_rels"
    DROP COLUMN IF EXISTS "itineraries_id";
  `)
}
