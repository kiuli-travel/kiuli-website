import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create enum for authors._status
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_authors_status') THEN
        CREATE TYPE "enum_authors_status" AS ENUM ('draft', 'published');
      END IF;
    END $$;
  `)

  // Create enum for _authors_v.version__status
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum__authors_v_version_status') THEN
        CREATE TYPE "enum__authors_v_version_status" AS ENUM ('draft', 'published');
      END IF;
    END $$;
  `)

  // Create authors table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "authors" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL UNIQUE,
      "role" varchar,
      "bio" jsonb,
      "short_bio" varchar,
      "photo_id" integer,
      "email" varchar,
      "linked_in" varchar,
      "meta_title" varchar,
      "meta_description" varchar,
      "canonical_url" varchar,
      "_status" "enum_authors_status" DEFAULT 'draft',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Create authors_credentials array table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "authors_credentials" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "text" varchar NOT NULL
    );
  `)

  // Add foreign key for credentials
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'authors_credentials_parent_id_fk'
      ) THEN
        ALTER TABLE "authors_credentials"
        ADD CONSTRAINT "authors_credentials_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "authors"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // Add foreign key for photo
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'authors_photo_id_media_id_fk'
      ) THEN
        ALTER TABLE "authors"
        ADD CONSTRAINT "authors_photo_id_media_id_fk"
        FOREIGN KEY ("photo_id") REFERENCES "media"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  // Create indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "authors_credentials_order_idx" ON "authors_credentials" ("_order");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "authors_credentials_parent_id_idx" ON "authors_credentials" ("_parent_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "authors_slug_idx" ON "authors" ("slug");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "authors_photo_idx" ON "authors" ("photo_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "authors_updated_at_idx" ON "authors" ("updated_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "authors_created_at_idx" ON "authors" ("created_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "authors__status_idx" ON "authors" ("_status");
  `)

  // Create versions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_authors_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_id" integer,
      "version_name" varchar NOT NULL,
      "version_slug" varchar NOT NULL,
      "version_role" varchar,
      "version_bio" jsonb,
      "version_short_bio" varchar,
      "version_photo_id" integer,
      "version_email" varchar,
      "version_linked_in" varchar,
      "version_meta_title" varchar,
      "version_meta_description" varchar,
      "version_canonical_url" varchar,
      "version__status" "enum__authors_v_version_status" DEFAULT 'draft',
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "latest" boolean,
      "autosave" boolean
    );
  `)

  // Create _authors_v_version_credentials array table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_authors_v_version_credentials" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "text" varchar,
      "_uuid" varchar
    );
  `)

  // Add foreign keys for versions
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_authors_v_parent_id_authors_id_fk'
      ) THEN
        ALTER TABLE "_authors_v"
        ADD CONSTRAINT "_authors_v_parent_id_authors_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "authors"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_authors_v_version_photo_id_media_id_fk'
      ) THEN
        ALTER TABLE "_authors_v"
        ADD CONSTRAINT "_authors_v_version_photo_id_media_id_fk"
        FOREIGN KEY ("version_photo_id") REFERENCES "media"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_authors_v_version_credentials_parent_id_fk'
      ) THEN
        ALTER TABLE "_authors_v_version_credentials"
        ADD CONSTRAINT "_authors_v_version_credentials_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_authors_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // Create indexes for versions
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_version_credentials_order_idx" ON "_authors_v_version_credentials" ("_order");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_version_credentials_parent_id_idx" ON "_authors_v_version_credentials" ("_parent_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_parent_idx" ON "_authors_v" ("parent_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_version_version_slug_idx" ON "_authors_v" ("version_slug");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_version_photo_idx" ON "_authors_v" ("version_photo_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_version_version_updated_at_idx" ON "_authors_v" ("version_updated_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_version_version_created_at_idx" ON "_authors_v" ("version_created_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_created_at_idx" ON "_authors_v" ("created_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_updated_at_idx" ON "_authors_v" ("updated_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_latest_idx" ON "_authors_v" ("latest");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_authors_v_autosave_idx" ON "_authors_v" ("autosave");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop version credentials table
  await db.execute(sql`DROP TABLE IF EXISTS "_authors_v_version_credentials";`)

  // Drop versions table
  await db.execute(sql`DROP TABLE IF EXISTS "_authors_v";`)

  // Drop credentials table
  await db.execute(sql`DROP TABLE IF EXISTS "authors_credentials";`)

  // Drop authors table
  await db.execute(sql`DROP TABLE IF EXISTS "authors";`)

  // Drop enum types
  await db.execute(sql`DROP TYPE IF EXISTS "enum__authors_v_version_status";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_authors_status";`)
}
