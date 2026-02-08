import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create destinations_highlights table for the array field
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "destinations_highlights" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "highlight" varchar
    );
  `)

  // Add foreign key
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'destinations_highlights_parent_id_fk'
      ) THEN
        ALTER TABLE "destinations_highlights"
        ADD CONSTRAINT "destinations_highlights_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "destinations"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // Add indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_highlights_order_idx"
    ON "destinations_highlights" ("_order");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "destinations_highlights_parent_id_idx"
    ON "destinations_highlights" ("_parent_id");
  `)

  // Also create versioned highlights table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_destinations_v_version_highlights" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "highlight" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_destinations_v_version_highlights_parent_id_fk'
      ) THEN
        ALTER TABLE "_destinations_v_version_highlights"
        ADD CONSTRAINT "_destinations_v_version_highlights_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_destinations_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_version_highlights_order_idx"
    ON "_destinations_v_version_highlights" ("_order");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_destinations_v_version_highlights_parent_id_idx"
    ON "_destinations_v_version_highlights" ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "_destinations_v_version_highlights";`)
  await db.execute(sql`DROP TABLE IF EXISTS "destinations_highlights";`)
}
