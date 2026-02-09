import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ============================================================
  // FIX: Create proper junction tables for block hasMany relationships
  // The original migration incorrectly added columns to pages_rels
  // instead of creating separate junction tables for each block.
  // ============================================================

  // ============================================================
  // FeaturedItineraries Block - Junction Table
  // ============================================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_featured_itineraries_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "itineraries_id" integer
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_featured_itineraries_rels_parent_fk'
      ) THEN
        ALTER TABLE "pages_blocks_featured_itineraries_rels"
        ADD CONSTRAINT "pages_blocks_featured_itineraries_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "pages_blocks_featured_itineraries"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_featured_itineraries_rels_itineraries_fk'
      ) THEN
        ALTER TABLE "pages_blocks_featured_itineraries_rels"
        ADD CONSTRAINT "pages_blocks_featured_itineraries_rels_itineraries_fk"
        FOREIGN KEY ("itineraries_id") REFERENCES "itineraries"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_itineraries_rels_order_idx" ON "pages_blocks_featured_itineraries_rels" ("order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_itineraries_rels_parent_idx" ON "pages_blocks_featured_itineraries_rels" ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_itineraries_rels_path_idx" ON "pages_blocks_featured_itineraries_rels" ("path");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_itineraries_rels_itineraries_idx" ON "pages_blocks_featured_itineraries_rels" ("itineraries_id");`)

  // ============================================================
  // DestinationHighlights Block - Junction Table
  // ============================================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_destination_highlights_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "destinations_id" integer
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_destination_highlights_rels_parent_fk'
      ) THEN
        ALTER TABLE "pages_blocks_destination_highlights_rels"
        ADD CONSTRAINT "pages_blocks_destination_highlights_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "pages_blocks_destination_highlights"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_destination_highlights_rels_destinations_fk'
      ) THEN
        ALTER TABLE "pages_blocks_destination_highlights_rels"
        ADD CONSTRAINT "pages_blocks_destination_highlights_rels_destinations_fk"
        FOREIGN KEY ("destinations_id") REFERENCES "destinations"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_destination_highlights_rels_order_idx" ON "pages_blocks_destination_highlights_rels" ("order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_destination_highlights_rels_parent_idx" ON "pages_blocks_destination_highlights_rels" ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_destination_highlights_rels_path_idx" ON "pages_blocks_destination_highlights_rels" ("path");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_destination_highlights_rels_destinations_idx" ON "pages_blocks_destination_highlights_rels" ("destinations_id");`)

  // ============================================================
  // FeaturedProperties Block - Junction Table
  // ============================================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_featured_properties_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "properties_id" integer
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_featured_properties_rels_parent_fk'
      ) THEN
        ALTER TABLE "pages_blocks_featured_properties_rels"
        ADD CONSTRAINT "pages_blocks_featured_properties_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "pages_blocks_featured_properties"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_featured_properties_rels_properties_fk'
      ) THEN
        ALTER TABLE "pages_blocks_featured_properties_rels"
        ADD CONSTRAINT "pages_blocks_featured_properties_rels_properties_fk"
        FOREIGN KEY ("properties_id") REFERENCES "properties"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_properties_rels_order_idx" ON "pages_blocks_featured_properties_rels" ("order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_properties_rels_parent_idx" ON "pages_blocks_featured_properties_rels" ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_properties_rels_path_idx" ON "pages_blocks_featured_properties_rels" ("path");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_properties_rels_properties_idx" ON "pages_blocks_featured_properties_rels" ("properties_id");`)

  // ============================================================
  // VERSION TABLES - Junction Tables for Drafts
  // ============================================================

  // FeaturedItineraries versions rels
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_featured_itineraries_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "itineraries_id" integer
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_pages_v_blocks_featured_itineraries_rels_parent_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_featured_itineraries_rels"
        ADD CONSTRAINT "_pages_v_blocks_featured_itineraries_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "_pages_v_blocks_featured_itineraries"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_itineraries_rels_order_idx" ON "_pages_v_blocks_featured_itineraries_rels" ("order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_itineraries_rels_parent_idx" ON "_pages_v_blocks_featured_itineraries_rels" ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_itineraries_rels_path_idx" ON "_pages_v_blocks_featured_itineraries_rels" ("path");`)

  // DestinationHighlights versions rels
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_destination_highlights_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "destinations_id" integer
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_pages_v_blocks_destination_highlights_rels_parent_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_destination_highlights_rels"
        ADD CONSTRAINT "_pages_v_blocks_destination_highlights_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "_pages_v_blocks_destination_highlights"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_destination_highlights_rels_order_idx" ON "_pages_v_blocks_destination_highlights_rels" ("order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_destination_highlights_rels_parent_idx" ON "_pages_v_blocks_destination_highlights_rels" ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_destination_highlights_rels_path_idx" ON "_pages_v_blocks_destination_highlights_rels" ("path");`)

  // FeaturedProperties versions rels
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_featured_properties_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "properties_id" integer
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_pages_v_blocks_featured_properties_rels_parent_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_featured_properties_rels"
        ADD CONSTRAINT "_pages_v_blocks_featured_properties_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "_pages_v_blocks_featured_properties"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_properties_rels_order_idx" ON "_pages_v_blocks_featured_properties_rels" ("order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_properties_rels_parent_idx" ON "_pages_v_blocks_featured_properties_rels" ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_properties_rels_path_idx" ON "_pages_v_blocks_featured_properties_rels" ("path");`)

  // ============================================================
  // Clean up incorrectly added columns from pages_rels
  // (These were added by the original migration but shouldn't be there)
  // ============================================================
  // Note: We leave these columns in place to avoid data loss warnings
  // They're not harmful, just unused for block relationships
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop version junction tables
  await db.execute(sql`DROP TABLE IF EXISTS "_pages_v_blocks_featured_properties_rels";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_pages_v_blocks_destination_highlights_rels";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_pages_v_blocks_featured_itineraries_rels";`)

  // Drop main junction tables
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_featured_properties_rels";`)
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_destination_highlights_rels";`)
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_featured_itineraries_rels";`)
}
