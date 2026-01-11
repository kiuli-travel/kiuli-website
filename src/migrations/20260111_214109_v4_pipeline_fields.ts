import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create enum types if they don't exist
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_media_country" AS ENUM('Tanzania', 'Kenya', 'Botswana', 'Rwanda', 'South Africa', 'Zimbabwe', 'Zambia', 'Namibia', 'Uganda', 'Mozambique', 'Unknown');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_media_image_type" AS ENUM('wildlife', 'landscape', 'accommodation', 'activity', 'people', 'food', 'aerial', 'detail');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_media_quality" AS ENUM('high', 'medium', 'low');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_itineraries_schema_status" AS ENUM('pending', 'pass', 'fail');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_itineraries_google_inspection_status" AS ENUM('pending', 'pass', 'fail');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_itineraries_status" AS ENUM('draft', 'published');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__itineraries_v_version_schema_status" AS ENUM('pending', 'pass', 'fail');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__itineraries_v_version_google_inspection_status" AS ENUM('pending', 'pass', 'fail');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__itineraries_v_version_status" AS ENUM('draft', 'published');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_itinerary_jobs_status" AS ENUM('pending', 'processing', 'completed', 'failed');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create tables if they don't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "itineraries" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "itinerary_id" varchar,
      "price" numeric,
      "price_formatted" varchar,
      "raw_itinerary" jsonb,
      "enhanced_itinerary" jsonb,
      "schema" jsonb,
      "faq" varchar,
      "schema_status" "enum_itineraries_schema_status" DEFAULT 'pending',
      "google_inspection_status" "enum_itineraries_google_inspection_status" DEFAULT 'pending',
      "build_timestamp" timestamp(3) with time zone,
      "google_failure_log" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "_status" "enum_itineraries_status" DEFAULT 'draft'
    );

    CREATE TABLE IF NOT EXISTS "itineraries_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "media_id" integer
    );

    CREATE TABLE IF NOT EXISTS "_itineraries_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_id" integer,
      "version_title" varchar,
      "version_itinerary_id" varchar,
      "version_price" numeric,
      "version_price_formatted" varchar,
      "version_raw_itinerary" jsonb,
      "version_enhanced_itinerary" jsonb,
      "version_schema" jsonb,
      "version_faq" varchar,
      "version_schema_status" "enum__itineraries_v_version_schema_status" DEFAULT 'pending',
      "version_google_inspection_status" "enum__itineraries_v_version_google_inspection_status" DEFAULT 'pending',
      "version_build_timestamp" timestamp(3) with time zone,
      "version_google_failure_log" varchar,
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "version__status" "enum__itineraries_v_version_status" DEFAULT 'draft',
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "latest" boolean
    );

    CREATE TABLE IF NOT EXISTS "_itineraries_v_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "media_id" integer
    );

    CREATE TABLE IF NOT EXISTS "itinerary_jobs" (
      "id" serial PRIMARY KEY NOT NULL,
      "itrvl_url" varchar NOT NULL,
      "itinerary_id" varchar,
      "access_key" varchar,
      "status" "enum_itinerary_jobs_status" DEFAULT 'pending' NOT NULL,
      "current_phase" varchar,
      "progress" numeric DEFAULT 0,
      "total_images" numeric,
      "processed_images" numeric,
      "skipped_images" numeric,
      "failed_images" numeric,
      "progress_log" varchar,
      "error_message" varchar,
      "error_phase" varchar,
      "failed_at" timestamp(3) with time zone,
      "processed_itinerary_id" integer,
      "payload_id" varchar,
      "started_at" timestamp(3) with time zone,
      "completed_at" timestamp(3) with time zone,
      "duration" numeric,
      "timings" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "itinerary_jobs_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "posts_id" integer
    );
  `);

  // Add columns to itinerary_jobs if they don't exist
  await db.execute(sql`
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "progress" numeric DEFAULT 0;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "total_images" numeric;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "processed_images" numeric;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "skipped_images" numeric;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "failed_images" numeric;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "progress_log" varchar;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "error_message" varchar;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "error_phase" varchar;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "failed_at" timestamp(3) with time zone;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "processed_itinerary_id" integer;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "payload_id" varchar;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "started_at" timestamp(3) with time zone;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "completed_at" timestamp(3) with time zone;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "duration" numeric;
    ALTER TABLE "itinerary_jobs" ADD COLUMN IF NOT EXISTS "timings" jsonb;
  `);

  // Add columns to media if they don't exist
  await db.execute(sql`
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "location" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "country" "enum_media_country";
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "image_type" "enum_media_image_type";
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "animals" jsonb;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "tags" jsonb;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "alt_text" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "is_hero" boolean DEFAULT false;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "quality" "enum_media_quality";
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "source_itinerary" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "s3_key" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "source_url" varchar;
  `);

  // Add columns to users if they don't exist
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "enable_a_p_i_key" boolean;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "api_key" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "api_key_index" varchar;
  `);

  // Add columns to payload_locked_documents_rels if they don't exist
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "itineraries_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "itinerary_jobs_id" integer;
  `);

  // Add foreign key constraints if they don't exist (using DO block to handle existing constraints)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "itineraries_rels" ADD CONSTRAINT "itineraries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "itineraries_rels" ADD CONSTRAINT "itineraries_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_itineraries_v" ADD CONSTRAINT "_itineraries_v_parent_id_itineraries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_itineraries_v_rels" ADD CONSTRAINT "_itineraries_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_itineraries_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_itineraries_v_rels" ADD CONSTRAINT "_itineraries_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "itinerary_jobs" ADD CONSTRAINT "itinerary_jobs_processed_itinerary_id_itineraries_id_fk" FOREIGN KEY ("processed_itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "itinerary_jobs_rels" ADD CONSTRAINT "itinerary_jobs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."itinerary_jobs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "itinerary_jobs_rels" ADD CONSTRAINT "itinerary_jobs_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_itineraries_fk" FOREIGN KEY ("itineraries_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_itinerary_jobs_fk" FOREIGN KEY ("itinerary_jobs_id") REFERENCES "public"."itinerary_jobs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create indexes if they don't exist
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "itineraries_itinerary_id_idx" ON "itineraries" USING btree ("itinerary_id");
    CREATE INDEX IF NOT EXISTS "itineraries_updated_at_idx" ON "itineraries" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "itineraries_created_at_idx" ON "itineraries" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "itineraries__status_idx" ON "itineraries" USING btree ("_status");
    CREATE INDEX IF NOT EXISTS "itineraries_rels_order_idx" ON "itineraries_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "itineraries_rels_parent_idx" ON "itineraries_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "itineraries_rels_path_idx" ON "itineraries_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "itineraries_rels_media_id_idx" ON "itineraries_rels" USING btree ("media_id");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_parent_idx" ON "_itineraries_v" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_version_version_itinerary_id_idx" ON "_itineraries_v" USING btree ("version_itinerary_id");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_version_version_updated_at_idx" ON "_itineraries_v" USING btree ("version_updated_at");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_version_version_created_at_idx" ON "_itineraries_v" USING btree ("version_created_at");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_version_version__status_idx" ON "_itineraries_v" USING btree ("version__status");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_created_at_idx" ON "_itineraries_v" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_updated_at_idx" ON "_itineraries_v" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_latest_idx" ON "_itineraries_v" USING btree ("latest");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_rels_order_idx" ON "_itineraries_v_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_rels_parent_idx" ON "_itineraries_v_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_rels_path_idx" ON "_itineraries_v_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "_itineraries_v_rels_media_id_idx" ON "_itineraries_v_rels" USING btree ("media_id");
    CREATE INDEX IF NOT EXISTS "itinerary_jobs_processed_itinerary_idx" ON "itinerary_jobs" USING btree ("processed_itinerary_id");
    CREATE INDEX IF NOT EXISTS "itinerary_jobs_updated_at_idx" ON "itinerary_jobs" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "itinerary_jobs_created_at_idx" ON "itinerary_jobs" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "itinerary_jobs_rels_order_idx" ON "itinerary_jobs_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "itinerary_jobs_rels_parent_idx" ON "itinerary_jobs_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "itinerary_jobs_rels_path_idx" ON "itinerary_jobs_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "itinerary_jobs_rels_posts_id_idx" ON "itinerary_jobs_rels" USING btree ("posts_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_itineraries_id_idx" ON "payload_locked_documents_rels" USING btree ("itineraries_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_itinerary_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("itinerary_jobs_id");
  `);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Note: down migration is simplified since we can't easily undo IF NOT EXISTS operations
  await db.execute(sql`
    DROP TABLE IF EXISTS "itineraries" CASCADE;
    DROP TABLE IF EXISTS "itineraries_rels" CASCADE;
    DROP TABLE IF EXISTS "_itineraries_v" CASCADE;
    DROP TABLE IF EXISTS "_itineraries_v_rels" CASCADE;
    DROP TABLE IF EXISTS "itinerary_jobs" CASCADE;
    DROP TABLE IF EXISTS "itinerary_jobs_rels" CASCADE;

    ALTER TABLE "media" DROP COLUMN IF EXISTS "location";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "country";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "image_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "animals";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "tags";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "alt_text";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "is_hero";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "quality";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "source_itinerary";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "s3_key";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "source_url";

    ALTER TABLE "users" DROP COLUMN IF EXISTS "enable_a_p_i_key";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "api_key";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "api_key_index";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "itineraries_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "itinerary_jobs_id";

    DROP TYPE IF EXISTS "public"."enum_media_country";
    DROP TYPE IF EXISTS "public"."enum_media_image_type";
    DROP TYPE IF EXISTS "public"."enum_media_quality";
    DROP TYPE IF EXISTS "public"."enum_itineraries_schema_status";
    DROP TYPE IF EXISTS "public"."enum_itineraries_google_inspection_status";
    DROP TYPE IF EXISTS "public"."enum_itineraries_status";
    DROP TYPE IF EXISTS "public"."enum__itineraries_v_version_schema_status";
    DROP TYPE IF EXISTS "public"."enum__itineraries_v_version_google_inspection_status";
    DROP TYPE IF EXISTS "public"."enum__itineraries_v_version_status";
    DROP TYPE IF EXISTS "public"."enum_itinerary_jobs_status";
  `);
}
