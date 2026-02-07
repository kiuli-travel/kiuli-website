import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration to add SEO, FAQ, and relationship fields to destinations collection
 * Also adds versioning/drafts support and changes bestTimeToVisit to richText
 *
 * Adding:
 * - _status (for drafts)
 * - canonicalUrl (text)
 * - answerCapsule (text)
 * - focusKeyword (text)
 * - lastModified (timestamp)
 * - faqItems (jsonb array)
 * - relatedItineraries (via _rels table)
 * - bestTimeToVisit changed from varchar to jsonb
 * - versioning tables
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add _status column for drafts
  await db.execute(sql`
    ALTER TABLE "destinations"
    ADD COLUMN IF NOT EXISTS "_status" varchar DEFAULT 'draft';
  `)

  // Add new SEO columns
  await db.execute(sql`
    ALTER TABLE "destinations"
    ADD COLUMN IF NOT EXISTS "canonical_url" varchar,
    ADD COLUMN IF NOT EXISTS "answer_capsule" varchar,
    ADD COLUMN IF NOT EXISTS "focus_keyword" varchar,
    ADD COLUMN IF NOT EXISTS "last_modified" timestamp(3) with time zone;
  `)

  // Change bestTimeToVisit from varchar to jsonb (for richText)
  // First, drop the old column if it exists as varchar
  await db.execute(sql`
    ALTER TABLE "destinations"
    DROP COLUMN IF EXISTS "best_time_to_visit";
  `)

  // Add as jsonb for richText
  await db.execute(sql`
    ALTER TABLE "destinations"
    ADD COLUMN IF NOT EXISTS "best_time_to_visit" jsonb;
  `)

  // Create destinations_faq_items table for the array field
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "destinations_faq_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "question" varchar,
      "answer" jsonb
    );
  `)

  // Add foreign key for faq_items
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'destinations_faq_items_parent_id_fk'
      ) THEN
        ALTER TABLE "destinations_faq_items"
        ADD CONSTRAINT "destinations_faq_items_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "destinations"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // Add index for faq_items order
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_faq_items_order_idx"
    ON "destinations_faq_items" ("_order");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_faq_items_parent_id_idx"
    ON "destinations_faq_items" ("_parent_id");
  `)

  // Create or update destinations_rels table for relationships
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "destinations_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "itineraries_id" integer,
      "destinations_id" integer
    );
  `)

  // Add foreign keys for rels table
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'destinations_rels_parent_fk'
      ) THEN
        ALTER TABLE "destinations_rels"
        ADD CONSTRAINT "destinations_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "destinations"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'destinations_rels_itineraries_fk'
      ) THEN
        ALTER TABLE "destinations_rels"
        ADD CONSTRAINT "destinations_rels_itineraries_fk"
        FOREIGN KEY ("itineraries_id") REFERENCES "itineraries"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // Add indexes for rels
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_rels_order_idx"
    ON "destinations_rels" ("order");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_rels_parent_idx"
    ON "destinations_rels" ("parent_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_rels_path_idx"
    ON "destinations_rels" ("path");
  `)

  // Create versioning table for destinations
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_destinations_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_id" integer,
      "version_name" varchar,
      "version_slug" varchar,
      "version_type" varchar,
      "version_country" integer,
      "version_description" jsonb,
      "version_hero_image" integer,
      "version_meta_title" varchar,
      "version_meta_description" varchar,
      "version_canonical_url" varchar,
      "version_answer_capsule" varchar,
      "version_focus_keyword" varchar,
      "version_last_modified" timestamp(3) with time zone,
      "version_best_time_to_visit" jsonb,
      "version__status" varchar DEFAULT 'draft',
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "latest" boolean,
      "autosave" boolean
    );
  `)

  // Add foreign key for versions
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_destinations_v_parent_id_destinations_id_fk'
      ) THEN
        ALTER TABLE "_destinations_v"
        ADD CONSTRAINT "_destinations_v_parent_id_destinations_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "destinations"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  // Add indexes for versions
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_parent_idx"
    ON "_destinations_v" ("parent_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_version_version_slug_idx"
    ON "_destinations_v" ("version_slug");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_version_version__status_idx"
    ON "_destinations_v" ("version__status");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_created_at_idx"
    ON "_destinations_v" ("created_at");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_updated_at_idx"
    ON "_destinations_v" ("updated_at");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_latest_idx"
    ON "_destinations_v" ("latest");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_autosave_idx"
    ON "_destinations_v" ("autosave");
  `)

  // Create versioned faq_items table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_destinations_v_version_faq_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "question" varchar,
      "answer" jsonb,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_destinations_v_version_faq_items_parent_id_fk'
      ) THEN
        ALTER TABLE "_destinations_v_version_faq_items"
        ADD CONSTRAINT "_destinations_v_version_faq_items_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_destinations_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_version_faq_items_order_idx"
    ON "_destinations_v_version_faq_items" ("_order");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_version_faq_items_parent_id_idx"
    ON "_destinations_v_version_faq_items" ("_parent_id");
  `)

  // Create versioned rels table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_destinations_v_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "itineraries_id" integer,
      "destinations_id" integer
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_destinations_v_rels_parent_fk'
      ) THEN
        ALTER TABLE "_destinations_v_rels"
        ADD CONSTRAINT "_destinations_v_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "_destinations_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_rels_order_idx"
    ON "_destinations_v_rels" ("order");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_rels_parent_idx"
    ON "_destinations_v_rels" ("parent_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_rels_path_idx"
    ON "_destinations_v_rels" ("path");
  `)

  // Add index for _status on main table
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations__status_idx"
    ON "destinations" ("_status");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop versioned tables
  await db.execute(sql`DROP TABLE IF EXISTS "_destinations_v_rels";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_destinations_v_version_faq_items";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_destinations_v";`)

  // Drop faq_items table
  await db.execute(sql`DROP TABLE IF EXISTS "destinations_faq_items";`)

  // Drop rels table
  await db.execute(sql`DROP TABLE IF EXISTS "destinations_rels";`)

  // Remove new columns
  await db.execute(sql`
    ALTER TABLE "destinations"
    DROP COLUMN IF EXISTS "_status",
    DROP COLUMN IF EXISTS "canonical_url",
    DROP COLUMN IF EXISTS "answer_capsule",
    DROP COLUMN IF EXISTS "focus_keyword",
    DROP COLUMN IF EXISTS "last_modified";
  `)

  // Revert bestTimeToVisit back to varchar
  await db.execute(sql`
    ALTER TABLE "destinations"
    DROP COLUMN IF EXISTS "best_time_to_visit";
  `)

  await db.execute(sql`
    ALTER TABLE "destinations"
    ADD COLUMN IF NOT EXISTS "best_time_to_visit" varchar;
  `)

  // Drop indexes
  await db.execute(sql`DROP INDEX IF EXISTS "destinations__status_idx";`)
}
