import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration to add base fields for resolveFields hook
 *
 * The resolveFields afterRead hook resolves two-field pairs (Enhanced ?? Itrvl)
 * into single base fields. These base fields were missing from the schema,
 * causing TypeScript errors when accessing the resolved values.
 *
 * Adding:
 * - itineraries.why_kiuli (jsonb)
 * - itineraries.overview_summary (jsonb)
 * - itineraries_blocks_stay.description (jsonb)
 * - itineraries_blocks_activity.description (jsonb)
 * - itineraries_blocks_transfer.description (jsonb)
 * - itineraries_faq_items.answer (jsonb)
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ============================================================
  // Main itineraries table
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "why_kiuli" jsonb,
    ADD COLUMN IF NOT EXISTS "overview_summary" jsonb;
  `)

  // ============================================================
  // Segment blocks - add base description field
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_stay"
    ADD COLUMN IF NOT EXISTS "description" jsonb;
  `)

  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_activity"
    ADD COLUMN IF NOT EXISTS "description" jsonb;
  `)

  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_transfer"
    ADD COLUMN IF NOT EXISTS "description" jsonb;
  `)

  // ============================================================
  // FAQ items - add base answer field
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "itineraries_faq_items"
    ADD COLUMN IF NOT EXISTS "answer" jsonb;
  `)

  // ============================================================
  // Versioned tables
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "_itineraries_v"
    ADD COLUMN IF NOT EXISTS "version_why_kiuli" jsonb,
    ADD COLUMN IF NOT EXISTS "version_overview_summary" jsonb;
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_stay"
    ADD COLUMN IF NOT EXISTS "description" jsonb;
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_activity"
    ADD COLUMN IF NOT EXISTS "description" jsonb;
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_transfer"
    ADD COLUMN IF NOT EXISTS "description" jsonb;
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_version_faq_items"
    ADD COLUMN IF NOT EXISTS "answer" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "itineraries"
    DROP COLUMN IF EXISTS "why_kiuli",
    DROP COLUMN IF EXISTS "overview_summary";
  `)

  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_stay"
    DROP COLUMN IF EXISTS "description";
  `)

  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_activity"
    DROP COLUMN IF EXISTS "description";
  `)

  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_transfer"
    DROP COLUMN IF EXISTS "description";
  `)

  await db.execute(sql`
    ALTER TABLE "itineraries_faq_items"
    DROP COLUMN IF EXISTS "answer";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v"
    DROP COLUMN IF EXISTS "version_why_kiuli",
    DROP COLUMN IF EXISTS "version_overview_summary";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_stay"
    DROP COLUMN IF EXISTS "description";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_activity"
    DROP COLUMN IF EXISTS "description";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_transfer"
    DROP COLUMN IF EXISTS "description";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_version_faq_items"
    DROP COLUMN IF EXISTS "answer";
  `)
}
