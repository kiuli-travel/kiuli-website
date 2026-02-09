import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ============================================================
  // PHASE 5 PART 2: Homepage Block Types
  // ============================================================

  // Create enum for value proposition image position
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_pages_blocks_value_proposition_image_position') THEN
        CREATE TYPE "enum_pages_blocks_value_proposition_image_position" AS ENUM ('left', 'right');
      END IF;
    END $$;
  `)

  // ============================================================
  // HomeHero Block
  // ============================================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_home_hero" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar NOT NULL,
      "subheading" varchar,
      "background_image_id" integer NOT NULL,
      "background_video_id" integer,
      "cta_label" varchar,
      "cta_link" varchar,
      "overlay_opacity" numeric DEFAULT 40,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_home_hero_parent_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_home_hero"
        ADD CONSTRAINT "pages_blocks_home_hero_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_home_hero_background_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_home_hero"
        ADD CONSTRAINT "pages_blocks_home_hero_background_image_id_media_id_fk"
        FOREIGN KEY ("background_image_id") REFERENCES "media"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_home_hero_background_video_id_media_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_home_hero"
        ADD CONSTRAINT "pages_blocks_home_hero_background_video_id_media_id_fk"
        FOREIGN KEY ("background_video_id") REFERENCES "media"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_home_hero_order_idx" ON "pages_blocks_home_hero" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_home_hero_parent_id_idx" ON "pages_blocks_home_hero" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_home_hero_path_idx" ON "pages_blocks_home_hero" ("_path");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_home_hero_background_image_idx" ON "pages_blocks_home_hero" ("background_image_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_home_hero_background_video_idx" ON "pages_blocks_home_hero" ("background_video_id");`)

  // ============================================================
  // FeaturedItineraries Block
  // ============================================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_featured_itineraries" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar,
      "subheading" varchar,
      "show_pricing" boolean DEFAULT true,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_featured_itineraries_parent_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_featured_itineraries"
        ADD CONSTRAINT "pages_blocks_featured_itineraries_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_itineraries_order_idx" ON "pages_blocks_featured_itineraries" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_itineraries_parent_id_idx" ON "pages_blocks_featured_itineraries" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_itineraries_path_idx" ON "pages_blocks_featured_itineraries" ("_path");`)

  // ============================================================
  // DestinationHighlights Block
  // ============================================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_destination_highlights" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar,
      "subheading" varchar,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_destination_highlights_parent_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_destination_highlights"
        ADD CONSTRAINT "pages_blocks_destination_highlights_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_destination_highlights_order_idx" ON "pages_blocks_destination_highlights" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_destination_highlights_parent_id_idx" ON "pages_blocks_destination_highlights" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_destination_highlights_path_idx" ON "pages_blocks_destination_highlights" ("_path");`)

  // ============================================================
  // ValueProposition Block
  // ============================================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_value_proposition" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar,
      "content" jsonb NOT NULL,
      "image_id" integer,
      "image_position" "enum_pages_blocks_value_proposition_image_position" DEFAULT 'right',
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_value_proposition_parent_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_value_proposition"
        ADD CONSTRAINT "pages_blocks_value_proposition_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_value_proposition_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_value_proposition"
        ADD CONSTRAINT "pages_blocks_value_proposition_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_value_proposition_order_idx" ON "pages_blocks_value_proposition" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_value_proposition_parent_id_idx" ON "pages_blocks_value_proposition" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_value_proposition_path_idx" ON "pages_blocks_value_proposition" ("_path");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_value_proposition_image_idx" ON "pages_blocks_value_proposition" ("image_id");`)

  // ============================================================
  // Testimonial Block
  // ============================================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_testimonial" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "quote" varchar NOT NULL,
      "attribution" varchar NOT NULL,
      "context" varchar,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_testimonial_parent_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_testimonial"
        ADD CONSTRAINT "pages_blocks_testimonial_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_testimonial_order_idx" ON "pages_blocks_testimonial" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_testimonial_parent_id_idx" ON "pages_blocks_testimonial" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_testimonial_path_idx" ON "pages_blocks_testimonial" ("_path");`)

  // ============================================================
  // FeaturedProperties Block
  // ============================================================
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_featured_properties" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar,
      "subheading" varchar,
      "block_name" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_blocks_featured_properties_parent_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_featured_properties"
        ADD CONSTRAINT "pages_blocks_featured_properties_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_properties_order_idx" ON "pages_blocks_featured_properties" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_properties_parent_id_idx" ON "pages_blocks_featured_properties" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_featured_properties_path_idx" ON "pages_blocks_featured_properties" ("_path");`)

  // ============================================================
  // Add relationship columns to pages_rels for hasMany relationships
  // ============================================================
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pages_rels' AND column_name = 'itineraries_id'
      ) THEN
        ALTER TABLE "pages_rels" ADD COLUMN "itineraries_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pages_rels' AND column_name = 'destinations_id'
      ) THEN
        ALTER TABLE "pages_rels" ADD COLUMN "destinations_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pages_rels' AND column_name = 'properties_id'
      ) THEN
        ALTER TABLE "pages_rels" ADD COLUMN "properties_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_rels_itineraries_fk'
      ) THEN
        ALTER TABLE "pages_rels"
        ADD CONSTRAINT "pages_rels_itineraries_fk"
        FOREIGN KEY ("itineraries_id") REFERENCES "itineraries"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_rels_destinations_fk'
      ) THEN
        ALTER TABLE "pages_rels"
        ADD CONSTRAINT "pages_rels_destinations_fk"
        FOREIGN KEY ("destinations_id") REFERENCES "destinations"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'pages_rels_properties_fk'
      ) THEN
        ALTER TABLE "pages_rels"
        ADD CONSTRAINT "pages_rels_properties_fk"
        FOREIGN KEY ("properties_id") REFERENCES "properties"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_rels_itineraries_id_idx" ON "pages_rels" ("itineraries_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_rels_destinations_id_idx" ON "pages_rels" ("destinations_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_rels_properties_id_idx" ON "pages_rels" ("properties_id");`)

  // ============================================================
  // Version tables for drafts
  // ============================================================

  // HomeHero versions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_home_hero" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar,
      "subheading" varchar,
      "background_image_id" integer,
      "background_video_id" integer,
      "cta_label" varchar,
      "cta_link" varchar,
      "overlay_opacity" numeric,
      "block_name" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_pages_v_blocks_home_hero_parent_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_home_hero"
        ADD CONSTRAINT "_pages_v_blocks_home_hero_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_home_hero_order_idx" ON "_pages_v_blocks_home_hero" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_home_hero_parent_id_idx" ON "_pages_v_blocks_home_hero" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_home_hero_path_idx" ON "_pages_v_blocks_home_hero" ("_path");`)

  // FeaturedItineraries versions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_featured_itineraries" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar,
      "subheading" varchar,
      "show_pricing" boolean,
      "block_name" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_pages_v_blocks_featured_itineraries_parent_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_featured_itineraries"
        ADD CONSTRAINT "_pages_v_blocks_featured_itineraries_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_itineraries_order_idx" ON "_pages_v_blocks_featured_itineraries" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_itineraries_parent_id_idx" ON "_pages_v_blocks_featured_itineraries" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_itineraries_path_idx" ON "_pages_v_blocks_featured_itineraries" ("_path");`)

  // DestinationHighlights versions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_destination_highlights" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar,
      "subheading" varchar,
      "block_name" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_pages_v_blocks_destination_highlights_parent_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_destination_highlights"
        ADD CONSTRAINT "_pages_v_blocks_destination_highlights_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_destination_highlights_order_idx" ON "_pages_v_blocks_destination_highlights" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_destination_highlights_parent_id_idx" ON "_pages_v_blocks_destination_highlights" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_destination_highlights_path_idx" ON "_pages_v_blocks_destination_highlights" ("_path");`)

  // ValueProposition versions
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum__pages_v_blocks_value_proposition_image_position') THEN
        CREATE TYPE "enum__pages_v_blocks_value_proposition_image_position" AS ENUM ('left', 'right');
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_value_proposition" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar,
      "content" jsonb,
      "image_id" integer,
      "image_position" "enum__pages_v_blocks_value_proposition_image_position",
      "block_name" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_pages_v_blocks_value_proposition_parent_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_value_proposition"
        ADD CONSTRAINT "_pages_v_blocks_value_proposition_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_value_proposition_order_idx" ON "_pages_v_blocks_value_proposition" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_value_proposition_parent_id_idx" ON "_pages_v_blocks_value_proposition" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_value_proposition_path_idx" ON "_pages_v_blocks_value_proposition" ("_path");`)

  // Testimonial versions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_testimonial" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "quote" varchar,
      "attribution" varchar,
      "context" varchar,
      "block_name" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_pages_v_blocks_testimonial_parent_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_testimonial"
        ADD CONSTRAINT "_pages_v_blocks_testimonial_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_testimonial_order_idx" ON "_pages_v_blocks_testimonial" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_testimonial_parent_id_idx" ON "_pages_v_blocks_testimonial" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_testimonial_path_idx" ON "_pages_v_blocks_testimonial" ("_path");`)

  // FeaturedProperties versions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_featured_properties" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar,
      "subheading" varchar,
      "block_name" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_pages_v_blocks_featured_properties_parent_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_featured_properties"
        ADD CONSTRAINT "_pages_v_blocks_featured_properties_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_properties_order_idx" ON "_pages_v_blocks_featured_properties" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_properties_parent_id_idx" ON "_pages_v_blocks_featured_properties" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_featured_properties_path_idx" ON "_pages_v_blocks_featured_properties" ("_path");`)

  // Version rels table updates
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '_pages_v_rels' AND column_name = 'itineraries_id'
      ) THEN
        ALTER TABLE "_pages_v_rels" ADD COLUMN "itineraries_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '_pages_v_rels' AND column_name = 'destinations_id'
      ) THEN
        ALTER TABLE "_pages_v_rels" ADD COLUMN "destinations_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '_pages_v_rels' AND column_name = 'properties_id'
      ) THEN
        ALTER TABLE "_pages_v_rels" ADD COLUMN "properties_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_rels_itineraries_id_idx" ON "_pages_v_rels" ("itineraries_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_rels_destinations_id_idx" ON "_pages_v_rels" ("destinations_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_rels_properties_id_idx" ON "_pages_v_rels" ("properties_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop version tables
  await db.execute(sql`DROP TABLE IF EXISTS "_pages_v_blocks_featured_properties";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_pages_v_blocks_testimonial";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_pages_v_blocks_value_proposition";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_pages_v_blocks_destination_highlights";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_pages_v_blocks_featured_itineraries";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_pages_v_blocks_home_hero";`)

  // Drop main block tables
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_featured_properties";`)
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_testimonial";`)
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_value_proposition";`)
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_destination_highlights";`)
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_featured_itineraries";`)
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_home_hero";`)

  // Drop enums
  await db.execute(sql`DROP TYPE IF EXISTS "enum__pages_v_blocks_value_proposition_image_position";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_pages_blocks_value_proposition_image_position";`)

  // Remove relationship columns (leave them as they're additive)
}
