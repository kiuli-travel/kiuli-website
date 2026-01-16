import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create enum types for image_statuses (if not exists)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_image_statuses_status" AS ENUM('pending', 'processing', 'complete', 'failed', 'skipped');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_image_statuses_segment_type" AS ENUM('stay', 'activity', 'transfer');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create image_statuses table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "image_statuses" (
      "id" serial PRIMARY KEY NOT NULL,
      "job_id" integer NOT NULL,
      "source_s3_key" varchar NOT NULL,
      "media_id" varchar,
      "status" "enum_image_statuses_status" DEFAULT 'pending',
      "error" varchar,
      "started_at" timestamp(3) with time zone,
      "completed_at" timestamp(3) with time zone,
      "property_name" varchar,
      "segment_type" "enum_image_statuses_segment_type",
      "segment_title" varchar,
      "day_index" numeric,
      "segment_index" numeric,
      "country" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  // Add foreign key
  await db.execute(sql`
    ALTER TABLE "image_statuses"
    ADD CONSTRAINT "image_statuses_job_id_itinerary_jobs_id_fk"
    FOREIGN KEY ("job_id") REFERENCES "public"."itinerary_jobs"("id")
    ON DELETE set null ON UPDATE no action;
  `);

  // Create indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "image_statuses_job_idx" ON "image_statuses" USING btree ("job_id");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "image_statuses_source_s3_key_idx" ON "image_statuses" USING btree ("source_s3_key");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "image_statuses_media_id_idx" ON "image_statuses" USING btree ("media_id");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "image_statuses_status_idx" ON "image_statuses" USING btree ("status");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "image_statuses_updated_at_idx" ON "image_statuses" USING btree ("updated_at");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "image_statuses_created_at_idx" ON "image_statuses" USING btree ("created_at");`);

  // Add column to payload_locked_documents_rels
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "image_statuses_id" integer;
  `);

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_image_statuses_fk"
    FOREIGN KEY ("image_statuses_id") REFERENCES "public"."image_statuses"("id")
    ON DELETE cascade ON UPDATE no action;
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_image_statuses_id_idx"
    ON "payload_locked_documents_rels" USING btree ("image_statuses_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_image_statuses_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_image_statuses_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "image_statuses_id";
    DROP TABLE IF EXISTS "image_statuses" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_image_statuses_status";
    DROP TYPE IF EXISTS "public"."enum_image_statuses_segment_type";
  `);
}
