import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ============================================================
  // PART 1: Add new columns for fields that don't have the split pattern yet
  // ============================================================

  // Title: Currently single field, need to add full pattern
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "title_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "title_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "title_reviewed" boolean DEFAULT false;
  `)

  // Copy existing title to title_itrvl
  await db.execute(sql`
    UPDATE "itineraries"
    SET "title_itrvl" = "title"
    WHERE "title_itrvl" IS NULL AND "title" IS NOT NULL;
  `)

  // MetaTitle: Currently single field
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "meta_title_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "meta_title_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "meta_title_reviewed" boolean DEFAULT false;
  `)

  // Copy existing metaTitle to meta_title_itrvl
  await db.execute(sql`
    UPDATE "itineraries"
    SET "meta_title_itrvl" = "meta_title"
    WHERE "meta_title_itrvl" IS NULL AND "meta_title" IS NOT NULL;
  `)

  // MetaDescription: Currently single field
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "meta_description_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "meta_description_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "meta_description_reviewed" boolean DEFAULT false;
  `)

  // Copy existing metaDescription
  await db.execute(sql`
    UPDATE "itineraries"
    SET "meta_description_itrvl" = "meta_description"
    WHERE "meta_description_itrvl" IS NULL AND "meta_description" IS NOT NULL;
  `)

  // ============================================================
  // PART 2: Add new whyKiuli fields with _itrvl/_enhanced naming
  // (keeping old columns for now, copying data to new columns)
  // ============================================================

  // whyKiuli: Add new _itrvl/_enhanced/_reviewed columns
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "why_kiuli_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "why_kiuli_enhanced" jsonb,
    ADD COLUMN IF NOT EXISTS "why_kiuli_reviewed" boolean DEFAULT false;
  `)

  // Copy from old column names (whyKiuliOriginal -> why_kiuli_itrvl)
  await db.execute(sql`
    UPDATE "itineraries"
    SET "why_kiuli_itrvl" = "why_kiuli_original"
    WHERE "why_kiuli_itrvl" IS NULL AND "why_kiuli_original" IS NOT NULL;
  `)

  // Copy whyKiuliEnhanced -> why_kiuli_enhanced
  await db.execute(sql`
    UPDATE "itineraries"
    SET "why_kiuli_enhanced" = "why_kiuli_enhanced"
    WHERE "why_kiuli_enhanced" IS NULL;
  `)

  // ============================================================
  // PART 3: Add heroImage_reviewed flag
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "hero_image_reviewed" boolean DEFAULT false;
  `)

  // ============================================================
  // PART 4: Also add to _itineraries_v (versioned table) if it exists
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "_itineraries_v"
    ADD COLUMN IF NOT EXISTS "version_title_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "version_title_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "version_title_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "version_meta_title_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "version_meta_title_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "version_meta_title_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "version_meta_description_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "version_meta_description_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "version_meta_description_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "version_why_kiuli_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "version_why_kiuli_enhanced" jsonb,
    ADD COLUMN IF NOT EXISTS "version_why_kiuli_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "version_hero_image_reviewed" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Note: Down migration preserves old columns, just removes new ones
  await db.execute(sql`
    ALTER TABLE "itineraries"
    DROP COLUMN IF EXISTS "title_itrvl",
    DROP COLUMN IF EXISTS "title_enhanced",
    DROP COLUMN IF EXISTS "title_reviewed",
    DROP COLUMN IF EXISTS "meta_title_itrvl",
    DROP COLUMN IF EXISTS "meta_title_enhanced",
    DROP COLUMN IF EXISTS "meta_title_reviewed",
    DROP COLUMN IF EXISTS "meta_description_itrvl",
    DROP COLUMN IF EXISTS "meta_description_enhanced",
    DROP COLUMN IF EXISTS "meta_description_reviewed",
    DROP COLUMN IF EXISTS "why_kiuli_itrvl",
    DROP COLUMN IF EXISTS "why_kiuli_enhanced",
    DROP COLUMN IF EXISTS "why_kiuli_reviewed",
    DROP COLUMN IF EXISTS "hero_image_reviewed";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v"
    DROP COLUMN IF EXISTS "version_title_itrvl",
    DROP COLUMN IF EXISTS "version_title_enhanced",
    DROP COLUMN IF EXISTS "version_title_reviewed",
    DROP COLUMN IF EXISTS "version_meta_title_itrvl",
    DROP COLUMN IF EXISTS "version_meta_title_enhanced",
    DROP COLUMN IF EXISTS "version_meta_title_reviewed",
    DROP COLUMN IF EXISTS "version_meta_description_itrvl",
    DROP COLUMN IF EXISTS "version_meta_description_enhanced",
    DROP COLUMN IF EXISTS "version_meta_description_reviewed",
    DROP COLUMN IF EXISTS "version_why_kiuli_itrvl",
    DROP COLUMN IF EXISTS "version_why_kiuli_enhanced",
    DROP COLUMN IF EXISTS "version_why_kiuli_reviewed",
    DROP COLUMN IF EXISTS "version_hero_image_reviewed";
  `)
}
