import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ============================================================
  // PART 1: Overview summary fields
  // Note: Payload stores group fields with underscore prefix in column names
  // e.g., overview.summaryItrvl -> overview_summary_itrvl
  // ============================================================

  // Add summaryItrvl column (copy from summaryOriginal if exists)
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "overview_summary_itrvl" jsonb;
  `)

  // Copy from summaryOriginal to summaryItrvl
  await db.execute(sql`
    UPDATE "itineraries"
    SET "overview_summary_itrvl" = "overview_summary_original"
    WHERE "overview_summary_itrvl" IS NULL AND "overview_summary_original" IS NOT NULL;
  `)

  // Note: summaryEnhanced already exists as overview_summary_enhanced

  // Add summaryReviewed flag
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "overview_summary_reviewed" boolean DEFAULT false;
  `)

  // ============================================================
  // PART 2: InvestmentLevel includes fields
  // ============================================================

  // Add includesItrvl column
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "investment_level_includes_itrvl" jsonb;
  `)

  // Copy from includes to includesItrvl if exists
  await db.execute(sql`
    UPDATE "itineraries"
    SET "investment_level_includes_itrvl" = "investment_level_includes"
    WHERE "investment_level_includes_itrvl" IS NULL AND "investment_level_includes" IS NOT NULL;
  `)

  // Add includesEnhanced column
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "investment_level_includes_enhanced" jsonb;
  `)

  // Add includesReviewed flag
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "investment_level_includes_reviewed" boolean DEFAULT false;
  `)

  // ============================================================
  // Also add to versioned table (_itineraries_v)
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "_itineraries_v"
    ADD COLUMN IF NOT EXISTS "version_overview_summary_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "version_overview_summary_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "version_investment_level_includes_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "version_investment_level_includes_enhanced" jsonb,
    ADD COLUMN IF NOT EXISTS "version_investment_level_includes_reviewed" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "itineraries"
    DROP COLUMN IF EXISTS "overview_summary_itrvl",
    DROP COLUMN IF EXISTS "overview_summary_reviewed",
    DROP COLUMN IF EXISTS "investment_level_includes_itrvl",
    DROP COLUMN IF EXISTS "investment_level_includes_enhanced",
    DROP COLUMN IF EXISTS "investment_level_includes_reviewed";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v"
    DROP COLUMN IF EXISTS "version_overview_summary_itrvl",
    DROP COLUMN IF EXISTS "version_overview_summary_reviewed",
    DROP COLUMN IF EXISTS "version_investment_level_includes_itrvl",
    DROP COLUMN IF EXISTS "version_investment_level_includes_enhanced",
    DROP COLUMN IF EXISTS "version_investment_level_includes_reviewed";
  `)
}
