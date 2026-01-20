import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ============================================================
  // Create junction tables for hasMany relationships
  // ============================================================

  // Itineraries <-> Destinations/TripTypes (many-to-many)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "itineraries_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "destinations_id" integer,
      "trip_types_id" integer
    );
  `)

  // Create indexes for performance
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "itineraries_rels_order_idx" ON "itineraries_rels" ("order");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "itineraries_rels_parent_idx" ON "itineraries_rels" ("parent_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "itineraries_rels_path_idx" ON "itineraries_rels" ("path");
  `)

  // ============================================================
  // Versioned table for relationships
  // ============================================================

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_itineraries_v_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "destinations_id" integer,
      "trip_types_id" integer
    );
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_itineraries_v_rels_order_idx" ON "_itineraries_v_rels" ("order");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_itineraries_v_rels_parent_idx" ON "_itineraries_v_rels" ("parent_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_itineraries_v_rels_path_idx" ON "_itineraries_v_rels" ("path");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "itineraries_rels";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_itineraries_v_rels";`)
}
