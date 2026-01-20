import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create trip_types table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "trip_types" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "description" jsonb,
      "short_description" varchar,
      "hero_image_id" integer,
      "icon" varchar,
      "meta_title" varchar,
      "meta_description" varchar,
      "sort_order" integer DEFAULT 0,
      "featured" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "trip_types_slug_unique" UNIQUE ("slug")
    );
  `);

  // Create index on slug
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "trip_types_slug_idx" ON "trip_types" ("slug");
  `);

  // Create index on sort_order for ordered listings
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "trip_types_sort_order_idx" ON "trip_types" ("sort_order");
  `);

  // Create index on featured for homepage queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "trip_types_featured_idx" ON "trip_types" ("featured");
  `);

  // Add foreign key for hero_image
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "trip_types"
      ADD CONSTRAINT "trip_types_hero_image_id_fk"
      FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id")
      ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "trip_types";`);
}
