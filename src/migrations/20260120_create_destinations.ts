import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create destinations table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "destinations" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "type" varchar NOT NULL,
      "country_id" integer,
      "description" jsonb,
      "hero_image_id" integer,
      "meta_title" varchar,
      "meta_description" varchar,
      "best_time_to_visit" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "destinations_slug_unique" UNIQUE ("slug")
    );
  `);

  // Create index on type for filtering
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_type_idx" ON "destinations" ("type");
  `);

  // Create index on slug for lookups
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_slug_idx" ON "destinations" ("slug");
  `);

  // Create destinations_highlights table for the array field
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "destinations_highlights" (
      "id" serial PRIMARY KEY NOT NULL,
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "highlight" varchar NOT NULL
    );
  `);

  // Add foreign key for highlights
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "destinations_highlights"
      ADD CONSTRAINT "destinations_highlights_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."destinations"("id")
      ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create indexes for highlights
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_highlights_order_idx"
    ON "destinations_highlights" USING btree ("_order");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_highlights_parent_id_idx"
    ON "destinations_highlights" USING btree ("_parent_id");
  `);

  // Add self-referential foreign key for country relationship
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "destinations"
      ADD CONSTRAINT "destinations_country_id_fk"
      FOREIGN KEY ("country_id") REFERENCES "public"."destinations"("id")
      ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Add foreign key for hero_image
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "destinations"
      ADD CONSTRAINT "destinations_hero_image_id_fk"
      FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id")
      ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "destinations_highlights";`);
  await db.execute(sql`DROP TABLE IF EXISTS "destinations";`);
}
