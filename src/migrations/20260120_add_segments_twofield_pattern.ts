import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ============================================================
  // PART 1: Days table - add titleItrvl/Enhanced/Reviewed
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "itineraries_days"
    ADD COLUMN IF NOT EXISTS "title_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "title_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "title_reviewed" boolean DEFAULT false;
  `)

  // Copy existing title to titleItrvl
  await db.execute(sql`
    UPDATE "itineraries_days"
    SET "title_itrvl" = "title"
    WHERE "title_itrvl" IS NULL AND "title" IS NOT NULL;
  `)

  // ============================================================
  // PART 2: Stay blocks - full two-field pattern
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_stay"
    ADD COLUMN IF NOT EXISTS "accommodation_name_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "accommodation_name_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "accommodation_name_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "description_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "description_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "inclusions_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "inclusions_enhanced" jsonb,
    ADD COLUMN IF NOT EXISTS "inclusions_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "images_reviewed" boolean DEFAULT false;
  `)

  // Copy existing data to *Itrvl columns
  await db.execute(sql`
    UPDATE "itineraries_blocks_stay"
    SET
      "accommodation_name_itrvl" = COALESCE("accommodation_name_itrvl", "accommodation_name"),
      "description_itrvl" = COALESCE("description_itrvl", "description_original"),
      "inclusions_itrvl" = COALESCE("inclusions_itrvl", "inclusions")
    WHERE "accommodation_name" IS NOT NULL
       OR "description_original" IS NOT NULL
       OR "inclusions" IS NOT NULL;
  `)

  // ============================================================
  // PART 3: Activity blocks - two-field pattern
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_activity"
    ADD COLUMN IF NOT EXISTS "title_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "title_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "title_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "description_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "description_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "images_reviewed" boolean DEFAULT false;
  `)

  // Copy existing data
  await db.execute(sql`
    UPDATE "itineraries_blocks_activity"
    SET
      "title_itrvl" = COALESCE("title_itrvl", "title"),
      "description_itrvl" = COALESCE("description_itrvl", "description_original")
    WHERE "title" IS NOT NULL
       OR "description_original" IS NOT NULL;
  `)

  // ============================================================
  // PART 4: Transfer blocks - two-field pattern
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_transfer"
    ADD COLUMN IF NOT EXISTS "title_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "title_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "title_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "description_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "description_reviewed" boolean DEFAULT false;
  `)

  // Copy existing data
  await db.execute(sql`
    UPDATE "itineraries_blocks_transfer"
    SET
      "title_itrvl" = COALESCE("title_itrvl", "title"),
      "description_itrvl" = COALESCE("description_itrvl", "description_original")
    WHERE "title" IS NOT NULL
       OR "description_original" IS NOT NULL;
  `)

  // ============================================================
  // PART 5: Versioned tables
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_version_days"
    ADD COLUMN IF NOT EXISTS "title_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "title_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "title_reviewed" boolean DEFAULT false;
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_stay"
    ADD COLUMN IF NOT EXISTS "accommodation_name_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "accommodation_name_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "accommodation_name_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "description_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "description_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "inclusions_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "inclusions_enhanced" jsonb,
    ADD COLUMN IF NOT EXISTS "inclusions_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "images_reviewed" boolean DEFAULT false;
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_activity"
    ADD COLUMN IF NOT EXISTS "title_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "title_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "title_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "description_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "description_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "images_reviewed" boolean DEFAULT false;
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_transfer"
    ADD COLUMN IF NOT EXISTS "title_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "title_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "title_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "description_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "description_reviewed" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop new columns from days table
  await db.execute(sql`
    ALTER TABLE "itineraries_days"
    DROP COLUMN IF EXISTS "title_itrvl",
    DROP COLUMN IF EXISTS "title_enhanced",
    DROP COLUMN IF EXISTS "title_reviewed";
  `)

  // Drop new columns from stay blocks
  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_stay"
    DROP COLUMN IF EXISTS "accommodation_name_itrvl",
    DROP COLUMN IF EXISTS "accommodation_name_enhanced",
    DROP COLUMN IF EXISTS "accommodation_name_reviewed",
    DROP COLUMN IF EXISTS "description_itrvl",
    DROP COLUMN IF EXISTS "description_reviewed",
    DROP COLUMN IF EXISTS "inclusions_itrvl",
    DROP COLUMN IF EXISTS "inclusions_enhanced",
    DROP COLUMN IF EXISTS "inclusions_reviewed",
    DROP COLUMN IF EXISTS "images_reviewed";
  `)

  // Drop new columns from activity blocks
  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_activity"
    DROP COLUMN IF EXISTS "title_itrvl",
    DROP COLUMN IF EXISTS "title_enhanced",
    DROP COLUMN IF EXISTS "title_reviewed",
    DROP COLUMN IF EXISTS "description_itrvl",
    DROP COLUMN IF EXISTS "description_reviewed",
    DROP COLUMN IF EXISTS "images_reviewed";
  `)

  // Drop new columns from transfer blocks
  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_transfer"
    DROP COLUMN IF EXISTS "title_itrvl",
    DROP COLUMN IF EXISTS "title_enhanced",
    DROP COLUMN IF EXISTS "title_reviewed",
    DROP COLUMN IF EXISTS "description_itrvl",
    DROP COLUMN IF EXISTS "description_reviewed";
  `)

  // Drop from versioned tables
  await db.execute(sql`
    ALTER TABLE "_itineraries_v_version_days"
    DROP COLUMN IF EXISTS "title_itrvl",
    DROP COLUMN IF EXISTS "title_enhanced",
    DROP COLUMN IF EXISTS "title_reviewed";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_stay"
    DROP COLUMN IF EXISTS "accommodation_name_itrvl",
    DROP COLUMN IF EXISTS "accommodation_name_enhanced",
    DROP COLUMN IF EXISTS "accommodation_name_reviewed",
    DROP COLUMN IF EXISTS "description_itrvl",
    DROP COLUMN IF EXISTS "description_reviewed",
    DROP COLUMN IF EXISTS "inclusions_itrvl",
    DROP COLUMN IF EXISTS "inclusions_enhanced",
    DROP COLUMN IF EXISTS "inclusions_reviewed",
    DROP COLUMN IF EXISTS "images_reviewed";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_activity"
    DROP COLUMN IF EXISTS "title_itrvl",
    DROP COLUMN IF EXISTS "title_enhanced",
    DROP COLUMN IF EXISTS "title_reviewed",
    DROP COLUMN IF EXISTS "description_itrvl",
    DROP COLUMN IF EXISTS "description_reviewed",
    DROP COLUMN IF EXISTS "images_reviewed";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_blocks_transfer"
    DROP COLUMN IF EXISTS "title_itrvl",
    DROP COLUMN IF EXISTS "title_enhanced",
    DROP COLUMN IF EXISTS "title_reviewed",
    DROP COLUMN IF EXISTS "description_itrvl",
    DROP COLUMN IF EXISTS "description_reviewed";
  `)
}
