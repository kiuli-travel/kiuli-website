import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add version field to itinerary_jobs table
  await db.execute(sql`
    ALTER TABLE "itinerary_jobs"
    ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1;
  `);

  // Create table for previous versions history
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "itinerary_jobs_previous_versions" (
      "id" serial PRIMARY KEY NOT NULL,
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "version" integer,
      "completed_at" timestamp(3) with time zone,
      "status" varchar
    );
  `);

  // Add foreign key
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "itinerary_jobs_previous_versions"
      ADD CONSTRAINT "itinerary_jobs_previous_versions_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."itinerary_jobs"("id")
      ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "itinerary_jobs_previous_versions_order_idx"
    ON "itinerary_jobs_previous_versions" USING btree ("_order");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "itinerary_jobs_previous_versions_parent_id_idx"
    ON "itinerary_jobs_previous_versions" USING btree ("_parent_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "itinerary_jobs_previous_versions";
  `);
  await db.execute(sql`
    ALTER TABLE "itinerary_jobs"
    DROP COLUMN IF EXISTS "version";
  `);
}
