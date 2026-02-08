import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ============================================================
  // TASK 3.5-B: Create Properties collection
  // ============================================================

  // Create enum for properties._status
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_properties_status') THEN
        CREATE TYPE "enum_properties_status" AS ENUM ('draft', 'published');
      END IF;
    END $$;
  `)

  // Create enum for properties.type
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_properties_type') THEN
        CREATE TYPE "enum_properties_type" AS ENUM ('lodge', 'camp', 'hotel', 'villa', 'mobile_camp', 'tented_camp');
      END IF;
    END $$;
  `)

  // Create enum for properties.price_tier
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_properties_price_tier') THEN
        CREATE TYPE "enum_properties_price_tier" AS ENUM ('comfort', 'premium', 'luxury', 'ultra_luxury');
      END IF;
    END $$;
  `)

  // Create properties table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "properties" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL UNIQUE,
      "type" "enum_properties_type",
      "destination_id" integer NOT NULL,
      "description_itrvl" varchar,
      "description_enhanced" jsonb,
      "description_reviewed" jsonb,
      "meta_title" varchar,
      "meta_description" varchar,
      "canonical_url" varchar,
      "answer_capsule" varchar,
      "focus_keyword" varchar,
      "last_modified" timestamp(3) with time zone,
      "hero_image_id" integer,
      "website_url" varchar,
      "price_tier" "enum_properties_price_tier",
      "_status" "enum_properties_status" DEFAULT 'draft',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Create properties_faq_items array table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "properties_faq_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "question" varchar NOT NULL,
      "answer" jsonb
    );
  `)

  // Create properties_gallery array table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "properties_gallery" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "image_id" integer NOT NULL
    );
  `)

  // Create properties_rels table (for hasMany relationships)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "properties_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "itineraries_id" integer,
      "posts_id" integer
    );
  `)

  // Add foreign keys for properties
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'properties_destination_id_destinations_id_fk'
      ) THEN
        ALTER TABLE "properties"
        ADD CONSTRAINT "properties_destination_id_destinations_id_fk"
        FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'properties_hero_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "properties"
        ADD CONSTRAINT "properties_hero_image_id_media_id_fk"
        FOREIGN KEY ("hero_image_id") REFERENCES "media"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'properties_faq_items_parent_id_fk'
      ) THEN
        ALTER TABLE "properties_faq_items"
        ADD CONSTRAINT "properties_faq_items_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "properties"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'properties_gallery_parent_id_fk'
      ) THEN
        ALTER TABLE "properties_gallery"
        ADD CONSTRAINT "properties_gallery_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "properties"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'properties_gallery_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "properties_gallery"
        ADD CONSTRAINT "properties_gallery_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'properties_rels_parent_fk'
      ) THEN
        ALTER TABLE "properties_rels"
        ADD CONSTRAINT "properties_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "properties"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'properties_rels_itineraries_fk'
      ) THEN
        ALTER TABLE "properties_rels"
        ADD CONSTRAINT "properties_rels_itineraries_fk"
        FOREIGN KEY ("itineraries_id") REFERENCES "itineraries"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'properties_rels_posts_fk'
      ) THEN
        ALTER TABLE "properties_rels"
        ADD CONSTRAINT "properties_rels_posts_fk"
        FOREIGN KEY ("posts_id") REFERENCES "posts"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // Create indexes for properties
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_slug_idx" ON "properties" ("slug");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_destination_idx" ON "properties" ("destination_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_hero_image_idx" ON "properties" ("hero_image_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_updated_at_idx" ON "properties" ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_created_at_idx" ON "properties" ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties__status_idx" ON "properties" ("_status");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_faq_items_order_idx" ON "properties_faq_items" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_faq_items_parent_id_idx" ON "properties_faq_items" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_gallery_order_idx" ON "properties_gallery" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_gallery_parent_id_idx" ON "properties_gallery" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_gallery_image_idx" ON "properties_gallery" ("image_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_rels_order_idx" ON "properties_rels" ("order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_rels_parent_idx" ON "properties_rels" ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_rels_path_idx" ON "properties_rels" ("path");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_rels_itineraries_id_idx" ON "properties_rels" ("itineraries_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "properties_rels_posts_id_idx" ON "properties_rels" ("posts_id");`)

  // Create _properties_v versions table
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum__properties_v_version_status') THEN
        CREATE TYPE "enum__properties_v_version_status" AS ENUM ('draft', 'published');
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum__properties_v_version_type') THEN
        CREATE TYPE "enum__properties_v_version_type" AS ENUM ('lodge', 'camp', 'hotel', 'villa', 'mobile_camp', 'tented_camp');
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum__properties_v_version_price_tier') THEN
        CREATE TYPE "enum__properties_v_version_price_tier" AS ENUM ('comfort', 'premium', 'luxury', 'ultra_luxury');
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_properties_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_id" integer,
      "version_name" varchar NOT NULL,
      "version_slug" varchar NOT NULL,
      "version_type" "enum__properties_v_version_type",
      "version_destination_id" integer,
      "version_description_itrvl" varchar,
      "version_description_enhanced" jsonb,
      "version_description_reviewed" jsonb,
      "version_meta_title" varchar,
      "version_meta_description" varchar,
      "version_canonical_url" varchar,
      "version_answer_capsule" varchar,
      "version_focus_keyword" varchar,
      "version_last_modified" timestamp(3) with time zone,
      "version_hero_image_id" integer,
      "version_website_url" varchar,
      "version_price_tier" "enum__properties_v_version_price_tier",
      "version__status" "enum__properties_v_version_status" DEFAULT 'draft',
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "latest" boolean,
      "autosave" boolean
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_properties_v_version_faq_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "question" varchar,
      "answer" jsonb,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_properties_v_version_gallery" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "image_id" integer,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_properties_v_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "itineraries_id" integer,
      "posts_id" integer
    );
  `)

  // Add foreign keys for versions
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_properties_v_parent_id_properties_id_fk'
      ) THEN
        ALTER TABLE "_properties_v"
        ADD CONSTRAINT "_properties_v_parent_id_properties_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "properties"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_properties_v_version_destination_id_destinations_id_fk'
      ) THEN
        ALTER TABLE "_properties_v"
        ADD CONSTRAINT "_properties_v_version_destination_id_destinations_id_fk"
        FOREIGN KEY ("version_destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_properties_v_version_hero_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "_properties_v"
        ADD CONSTRAINT "_properties_v_version_hero_image_id_media_id_fk"
        FOREIGN KEY ("version_hero_image_id") REFERENCES "media"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_properties_v_version_faq_items_parent_id_fk'
      ) THEN
        ALTER TABLE "_properties_v_version_faq_items"
        ADD CONSTRAINT "_properties_v_version_faq_items_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_properties_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_properties_v_version_gallery_parent_id_fk'
      ) THEN
        ALTER TABLE "_properties_v_version_gallery"
        ADD CONSTRAINT "_properties_v_version_gallery_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_properties_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_properties_v_version_gallery_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "_properties_v_version_gallery"
        ADD CONSTRAINT "_properties_v_version_gallery_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_properties_v_rels_parent_fk'
      ) THEN
        ALTER TABLE "_properties_v_rels"
        ADD CONSTRAINT "_properties_v_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "_properties_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_properties_v_rels_itineraries_fk'
      ) THEN
        ALTER TABLE "_properties_v_rels"
        ADD CONSTRAINT "_properties_v_rels_itineraries_fk"
        FOREIGN KEY ("itineraries_id") REFERENCES "itineraries"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_properties_v_rels_posts_fk'
      ) THEN
        ALTER TABLE "_properties_v_rels"
        ADD CONSTRAINT "_properties_v_rels_posts_fk"
        FOREIGN KEY ("posts_id") REFERENCES "posts"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // Create indexes for versions
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_parent_idx" ON "_properties_v" ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_version_version_slug_idx" ON "_properties_v" ("version_slug");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_version_destination_idx" ON "_properties_v" ("version_destination_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_version_hero_image_idx" ON "_properties_v" ("version_hero_image_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_version_version_updated_at_idx" ON "_properties_v" ("version_updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_version_version_created_at_idx" ON "_properties_v" ("version_created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_created_at_idx" ON "_properties_v" ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_updated_at_idx" ON "_properties_v" ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_latest_idx" ON "_properties_v" ("latest");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_autosave_idx" ON "_properties_v" ("autosave");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_version_faq_items_order_idx" ON "_properties_v_version_faq_items" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_version_faq_items_parent_id_idx" ON "_properties_v_version_faq_items" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_version_gallery_order_idx" ON "_properties_v_version_gallery" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_version_gallery_parent_id_idx" ON "_properties_v_version_gallery" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_version_gallery_image_idx" ON "_properties_v_version_gallery" ("image_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_rels_order_idx" ON "_properties_v_rels" ("order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_rels_parent_idx" ON "_properties_v_rels" ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_rels_path_idx" ON "_properties_v_rels" ("path");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_rels_itineraries_id_idx" ON "_properties_v_rels" ("itineraries_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_properties_v_rels_posts_id_idx" ON "_properties_v_rels" ("posts_id");`)

  // ============================================================
  // TASK 3.5-C: Create PropertyNameMappings global
  // ============================================================

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "property_name_mappings" (
      "id" serial PRIMARY KEY NOT NULL,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "property_name_mappings_mappings" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "canonical" varchar NOT NULL,
      "aliases" jsonb,
      "property_id" integer NOT NULL
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'property_name_mappings_mappings_parent_id_fk'
      ) THEN
        ALTER TABLE "property_name_mappings_mappings"
        ADD CONSTRAINT "property_name_mappings_mappings_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "property_name_mappings"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'property_name_mappings_mappings_property_id_fk'
      ) THEN
        ALTER TABLE "property_name_mappings_mappings"
        ADD CONSTRAINT "property_name_mappings_mappings_property_id_fk"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "property_name_mappings_mappings_order_idx" ON "property_name_mappings_mappings" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "property_name_mappings_mappings_parent_id_idx" ON "property_name_mappings_mappings" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "property_name_mappings_mappings_property_idx" ON "property_name_mappings_mappings" ("property_id");`)

  // ============================================================
  // TASK 3.5-D: Add property relationship to itinerary stay segments
  // ============================================================

  // Add property_id column to itineraries_blocks_stay table
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'itineraries_blocks_stay' AND column_name = 'property_id'
      ) THEN
        ALTER TABLE "itineraries_blocks_stay"
        ADD COLUMN "property_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'itineraries_blocks_stay_property_id_properties_id_fk'
      ) THEN
        ALTER TABLE "itineraries_blocks_stay"
        ADD CONSTRAINT "itineraries_blocks_stay_property_id_properties_id_fk"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "itineraries_blocks_stay_property_idx" ON "itineraries_blocks_stay" ("property_id");`)

  // Add to versions table as well
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '_itineraries_v_blocks_stay' AND column_name = 'property_id'
      ) THEN
        ALTER TABLE "_itineraries_v_blocks_stay"
        ADD COLUMN "property_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_itineraries_v_blocks_stay_property_id_properties_id_fk'
      ) THEN
        ALTER TABLE "_itineraries_v_blocks_stay"
        ADD CONSTRAINT "_itineraries_v_blocks_stay_property_id_properties_id_fk"
        FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_itineraries_v_blocks_stay_property_idx" ON "_itineraries_v_blocks_stay" ("property_id");`)

  // ============================================================
  // TASK 3.5-E: Add featuredProperties to Destinations
  // ============================================================

  // Add to destinations_rels table
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'destinations_rels' AND column_name = 'properties_id'
      ) THEN
        ALTER TABLE "destinations_rels"
        ADD COLUMN "properties_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'destinations_rels_properties_fk'
      ) THEN
        ALTER TABLE "destinations_rels"
        ADD CONSTRAINT "destinations_rels_properties_fk"
        FOREIGN KEY ("properties_id") REFERENCES "properties"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "destinations_rels_properties_id_idx" ON "destinations_rels" ("properties_id");`)

  // Add to _destinations_v_rels table
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '_destinations_v_rels' AND column_name = 'properties_id'
      ) THEN
        ALTER TABLE "_destinations_v_rels"
        ADD COLUMN "properties_id" integer;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_destinations_v_rels_properties_fk'
      ) THEN
        ALTER TABLE "_destinations_v_rels"
        ADD CONSTRAINT "_destinations_v_rels_properties_fk"
        FOREIGN KEY ("properties_id") REFERENCES "properties"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_destinations_v_rels_properties_id_idx" ON "_destinations_v_rels" ("properties_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // ============================================================
  // TASK 3.5-E: Remove featuredProperties from Destinations
  // ============================================================
  await db.execute(sql`ALTER TABLE "_destinations_v_rels" DROP CONSTRAINT IF EXISTS "_destinations_v_rels_properties_fk";`)
  await db.execute(sql`ALTER TABLE "_destinations_v_rels" DROP COLUMN IF EXISTS "properties_id";`)
  await db.execute(sql`ALTER TABLE "destinations_rels" DROP CONSTRAINT IF EXISTS "destinations_rels_properties_fk";`)
  await db.execute(sql`ALTER TABLE "destinations_rels" DROP COLUMN IF EXISTS "properties_id";`)

  // ============================================================
  // TASK 3.5-D: Remove property relationship from itinerary stay segments
  // ============================================================
  await db.execute(sql`ALTER TABLE "_itineraries_v_blocks_stay" DROP CONSTRAINT IF EXISTS "_itineraries_v_blocks_stay_property_id_properties_id_fk";`)
  await db.execute(sql`ALTER TABLE "_itineraries_v_blocks_stay" DROP COLUMN IF EXISTS "property_id";`)
  await db.execute(sql`ALTER TABLE "itineraries_blocks_stay" DROP CONSTRAINT IF EXISTS "itineraries_blocks_stay_property_id_properties_id_fk";`)
  await db.execute(sql`ALTER TABLE "itineraries_blocks_stay" DROP COLUMN IF EXISTS "property_id";`)

  // ============================================================
  // TASK 3.5-C: Remove PropertyNameMappings global
  // ============================================================
  await db.execute(sql`DROP TABLE IF EXISTS "property_name_mappings_mappings";`)
  await db.execute(sql`DROP TABLE IF EXISTS "property_name_mappings";`)

  // ============================================================
  // TASK 3.5-B: Remove Properties collection
  // ============================================================
  await db.execute(sql`DROP TABLE IF EXISTS "_properties_v_rels";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_properties_v_version_gallery";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_properties_v_version_faq_items";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_properties_v";`)
  await db.execute(sql`DROP TABLE IF EXISTS "properties_rels";`)
  await db.execute(sql`DROP TABLE IF EXISTS "properties_gallery";`)
  await db.execute(sql`DROP TABLE IF EXISTS "properties_faq_items";`)
  await db.execute(sql`DROP TABLE IF EXISTS "properties";`)

  await db.execute(sql`DROP TYPE IF EXISTS "enum__properties_v_version_price_tier";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum__properties_v_version_type";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum__properties_v_version_status";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_properties_price_tier";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_properties_type";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_properties_status";`)
}
