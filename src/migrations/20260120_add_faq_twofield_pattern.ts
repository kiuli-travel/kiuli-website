import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ============================================================
  // FAQ Items table - add questionItrvl/Enhanced/Reviewed and answerItrvl/Reviewed
  // ============================================================

  // Question fields (currently single field 'question')
  await db.execute(sql`
    ALTER TABLE "itineraries_faq_items"
    ADD COLUMN IF NOT EXISTS "question_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "question_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "question_reviewed" boolean DEFAULT false;
  `)

  // Copy existing question to questionItrvl
  await db.execute(sql`
    UPDATE "itineraries_faq_items"
    SET "question_itrvl" = "question"
    WHERE "question_itrvl" IS NULL AND "question" IS NOT NULL;
  `)

  // Answer fields - answerOriginal/Enhanced already exist, add answerItrvl and answerReviewed
  await db.execute(sql`
    ALTER TABLE "itineraries_faq_items"
    ADD COLUMN IF NOT EXISTS "answer_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "answer_reviewed" boolean DEFAULT false;
  `)

  // Copy existing answerOriginal to answerItrvl
  await db.execute(sql`
    UPDATE "itineraries_faq_items"
    SET "answer_itrvl" = "answer_original"
    WHERE "answer_itrvl" IS NULL AND "answer_original" IS NOT NULL;
  `)

  // ============================================================
  // Versioned table
  // ============================================================

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_version_faq_items"
    ADD COLUMN IF NOT EXISTS "question_itrvl" varchar,
    ADD COLUMN IF NOT EXISTS "question_enhanced" varchar,
    ADD COLUMN IF NOT EXISTS "question_reviewed" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "answer_itrvl" jsonb,
    ADD COLUMN IF NOT EXISTS "answer_reviewed" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "itineraries_faq_items"
    DROP COLUMN IF EXISTS "question_itrvl",
    DROP COLUMN IF EXISTS "question_enhanced",
    DROP COLUMN IF EXISTS "question_reviewed",
    DROP COLUMN IF EXISTS "answer_itrvl",
    DROP COLUMN IF EXISTS "answer_reviewed";
  `)

  await db.execute(sql`
    ALTER TABLE "_itineraries_v_version_faq_items"
    DROP COLUMN IF EXISTS "question_itrvl",
    DROP COLUMN IF EXISTS "question_enhanced",
    DROP COLUMN IF EXISTS "question_reviewed",
    DROP COLUMN IF EXISTS "answer_itrvl",
    DROP COLUMN IF EXISTS "answer_reviewed";
  `)
}
