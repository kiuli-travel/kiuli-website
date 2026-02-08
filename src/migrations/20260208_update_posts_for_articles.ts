import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Updates Posts collection for Articles interface:
 * - Add excerpt column
 * - Add SEO fields (answerCapsule, focusKeyword, lastModified) to meta group
 * - Add faqItems array table
 * - Add itineraries_id and authors_id to posts_rels table
 * - Update authors relation from users to authors collection
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Add excerpt column to posts
  await db.execute(sql`
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "excerpt" varchar;
  `)

  // 2. Add SEO fields to meta group
  await db.execute(sql`
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "meta_answer_capsule" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "meta_focus_keyword" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "meta_last_modified" timestamp(3) with time zone;
  `)

  // 3. Add itineraries_id to posts_rels table for relatedItineraries relationship
  await db.execute(sql`
    ALTER TABLE "posts_rels" ADD COLUMN IF NOT EXISTS "itineraries_id" integer;
  `)

  // 4. Add authors_id to posts_rels table for authors relationship pointing to authors collection
  await db.execute(sql`
    ALTER TABLE "posts_rels" ADD COLUMN IF NOT EXISTS "authors_id" integer;
  `)

  // 5. Add foreign key for itineraries
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'posts_rels_itineraries_id_itineraries_id_fk'
      ) THEN
        ALTER TABLE "posts_rels"
        ADD CONSTRAINT "posts_rels_itineraries_id_itineraries_id_fk"
        FOREIGN KEY ("itineraries_id") REFERENCES "itineraries"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // 6. Add foreign key for authors
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'posts_rels_authors_id_authors_id_fk'
      ) THEN
        ALTER TABLE "posts_rels"
        ADD CONSTRAINT "posts_rels_authors_id_authors_id_fk"
        FOREIGN KEY ("authors_id") REFERENCES "authors"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // 7. Add indexes for the new relationship columns
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "posts_rels_itineraries_id_idx" ON "posts_rels" ("itineraries_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "posts_rels_authors_id_idx" ON "posts_rels" ("authors_id");
  `)

  // 8. Create posts_faq_items array table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "posts_faq_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "question" varchar NOT NULL,
      "answer" jsonb
    );
  `)

  // 9. Add foreign key for faq_items
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'posts_faq_items_parent_id_fk'
      ) THEN
        ALTER TABLE "posts_faq_items"
        ADD CONSTRAINT "posts_faq_items_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "posts"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // 10. Add indexes for faq_items
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "posts_faq_items_order_idx" ON "posts_faq_items" ("_order");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "posts_faq_items_parent_id_idx" ON "posts_faq_items" ("_parent_id");
  `)

  // 11. Update _posts_v table with the same columns for versioning
  await db.execute(sql`
    ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_excerpt" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_meta_answer_capsule" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_meta_focus_keyword" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_meta_last_modified" timestamp(3) with time zone;
  `)

  // 12. Add itineraries_id and authors_id to _posts_v_rels table
  await db.execute(sql`
    ALTER TABLE "_posts_v_rels" ADD COLUMN IF NOT EXISTS "itineraries_id" integer;
  `)
  await db.execute(sql`
    ALTER TABLE "_posts_v_rels" ADD COLUMN IF NOT EXISTS "authors_id" integer;
  `)

  // 13. Add foreign keys for version rels
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_posts_v_rels_itineraries_id_itineraries_id_fk'
      ) THEN
        ALTER TABLE "_posts_v_rels"
        ADD CONSTRAINT "_posts_v_rels_itineraries_id_itineraries_id_fk"
        FOREIGN KEY ("itineraries_id") REFERENCES "itineraries"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_posts_v_rels_authors_id_authors_id_fk'
      ) THEN
        ALTER TABLE "_posts_v_rels"
        ADD CONSTRAINT "_posts_v_rels_authors_id_authors_id_fk"
        FOREIGN KEY ("authors_id") REFERENCES "authors"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // 14. Add indexes for version rels
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_posts_v_rels_itineraries_id_idx" ON "_posts_v_rels" ("itineraries_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_posts_v_rels_authors_id_idx" ON "_posts_v_rels" ("authors_id");
  `)

  // 15. Create _posts_v_version_faq_items array table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_posts_v_version_faq_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "question" varchar,
      "answer" jsonb,
      "_uuid" varchar
    );
  `)

  // 16. Add foreign key for version faq_items
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = '_posts_v_version_faq_items_parent_id_fk'
      ) THEN
        ALTER TABLE "_posts_v_version_faq_items"
        ADD CONSTRAINT "_posts_v_version_faq_items_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_posts_v"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  // 17. Add indexes for version faq_items
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_posts_v_version_faq_items_order_idx" ON "_posts_v_version_faq_items" ("_order");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "_posts_v_version_faq_items_parent_id_idx" ON "_posts_v_version_faq_items" ("_parent_id");
  `)

  // Note: We don't drop the users_id column from posts_rels as it may have existing data
  // that needs to be migrated. The users_id column will remain but unused for new posts.
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop version faq_items table
  await db.execute(sql`DROP TABLE IF EXISTS "_posts_v_version_faq_items";`)

  // Drop faq_items table
  await db.execute(sql`DROP TABLE IF EXISTS "posts_faq_items";`)

  // Drop columns from posts
  await db.execute(sql`ALTER TABLE "posts" DROP COLUMN IF EXISTS "excerpt";`)
  await db.execute(sql`ALTER TABLE "posts" DROP COLUMN IF EXISTS "meta_answer_capsule";`)
  await db.execute(sql`ALTER TABLE "posts" DROP COLUMN IF EXISTS "meta_focus_keyword";`)
  await db.execute(sql`ALTER TABLE "posts" DROP COLUMN IF EXISTS "meta_last_modified";`)

  // Drop columns from _posts_v
  await db.execute(sql`ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_excerpt";`)
  await db.execute(sql`ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_meta_answer_capsule";`)
  await db.execute(sql`ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_meta_focus_keyword";`)
  await db.execute(sql`ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_meta_last_modified";`)

  // Drop relationship columns (careful - this will lose data)
  await db.execute(sql`ALTER TABLE "posts_rels" DROP COLUMN IF EXISTS "itineraries_id";`)
  await db.execute(sql`ALTER TABLE "posts_rels" DROP COLUMN IF EXISTS "authors_id";`)
  await db.execute(sql`ALTER TABLE "_posts_v_rels" DROP COLUMN IF EXISTS "itineraries_id";`)
  await db.execute(sql`ALTER TABLE "_posts_v_rels" DROP COLUMN IF EXISTS "authors_id";`)
}
