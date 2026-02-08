import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * MIGRATION ALREADY APPLIED MANUALLY ON 2026-02-08
 *
 * This migration documents the database fixes made to resolve the Destinations
 * admin list view issue. The fixes were applied directly to the production
 * database via psql.
 *
 * Issues fixed:
 * 1. version__status column was varchar, should be enum
 * 2. version_type column was varchar, should be enum
 * 3. _status column on destinations was varchar, should be enum
 * 4. version_country column should be version_country_id
 * 5. version_hero_image column should be version_hero_image_id
 * 6. _destinations_v table had no records (version records needed)
 * 7. _destinations_v_version_highlights table was missing
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Create enum type for destinations._status
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_destinations_status') THEN
        CREATE TYPE "enum_destinations_status" AS ENUM ('draft', 'published');
      END IF;
    END $$;
  `)

  // 2. Create enum type for _destinations_v.version__status
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum__destinations_v_version_status') THEN
        CREATE TYPE "enum__destinations_v_version_status" AS ENUM ('draft', 'published');
      END IF;
    END $$;
  `)

  // 3. Create enum type for _destinations_v.version_type
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum__destinations_v_version_type') THEN
        CREATE TYPE "enum__destinations_v_version_type" AS ENUM ('country', 'region', 'park');
      END IF;
    END $$;
  `)

  // 4. Alter destinations._status to use enum (if still varchar)
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'destinations'
        AND column_name = '_status'
        AND data_type = 'character varying'
      ) THEN
        ALTER TABLE "destinations" ALTER COLUMN "_status" DROP DEFAULT;
        ALTER TABLE "destinations" ALTER COLUMN "_status" TYPE "enum_destinations_status"
          USING "_status"::"enum_destinations_status";
        ALTER TABLE "destinations" ALTER COLUMN "_status" SET DEFAULT 'draft'::"enum_destinations_status";
      END IF;
    END $$;
  `)

  // 5. Alter _destinations_v.version__status to use enum (if still varchar)
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '_destinations_v'
        AND column_name = 'version__status'
        AND data_type = 'character varying'
      ) THEN
        ALTER TABLE "_destinations_v" ALTER COLUMN "version__status" DROP DEFAULT;
        ALTER TABLE "_destinations_v" ALTER COLUMN "version__status" TYPE "enum__destinations_v_version_status"
          USING "version__status"::"enum__destinations_v_version_status";
        ALTER TABLE "_destinations_v" ALTER COLUMN "version__status" SET DEFAULT 'draft'::"enum__destinations_v_version_status";
      END IF;
    END $$;
  `)

  // 6. Alter _destinations_v.version_type to use enum (if still varchar)
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '_destinations_v'
        AND column_name = 'version_type'
        AND data_type = 'character varying'
      ) THEN
        ALTER TABLE "_destinations_v" ALTER COLUMN "version_type" TYPE "enum__destinations_v_version_type"
          USING "version_type"::"enum__destinations_v_version_type";
      END IF;
    END $$;
  `)

  // 7. Rename version_country to version_country_id (if exists with old name)
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '_destinations_v'
        AND column_name = 'version_country'
      ) THEN
        ALTER TABLE "_destinations_v" RENAME COLUMN "version_country" TO "version_country_id";
      END IF;
    END $$;
  `)

  // 8. Rename version_hero_image to version_hero_image_id (if exists with old name)
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '_destinations_v'
        AND column_name = 'version_hero_image'
      ) THEN
        ALTER TABLE "_destinations_v" RENAME COLUMN "version_hero_image" TO "version_hero_image_id";
      END IF;
    END $$;
  `)

  // 9. Create _destinations_v_version_highlights table if missing
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

  // 10. Create initial version records for destinations that don't have them
  await db.execute(sql`
    INSERT INTO "_destinations_v" (
      parent_id,
      version_name,
      version_slug,
      version_type,
      version_country_id,
      version_description,
      version_hero_image_id,
      version_meta_title,
      version_meta_description,
      version_canonical_url,
      version_answer_capsule,
      version_focus_keyword,
      version_last_modified,
      version_best_time_to_visit,
      version__status,
      version_updated_at,
      version_created_at,
      created_at,
      updated_at,
      latest,
      autosave
    )
    SELECT
      d.id,
      d.name,
      d.slug,
      d.type::text::"enum__destinations_v_version_type",
      d.country_id,
      d.description,
      d.hero_image_id,
      d.meta_title,
      d.meta_description,
      d.canonical_url,
      d.answer_capsule,
      d.focus_keyword,
      d.last_modified,
      d.best_time_to_visit,
      d._status::text::"enum__destinations_v_version_status",
      d.updated_at,
      d.created_at,
      NOW(),
      NOW(),
      true,
      false
    FROM destinations d
    WHERE NOT EXISTS (
      SELECT 1 FROM "_destinations_v" v WHERE v.parent_id = d.id
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // This migration documents fixes that were already applied.
  // Reverting would break the admin panel.
  // Down migration is intentionally empty.
}
