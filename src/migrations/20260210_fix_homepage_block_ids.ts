import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration to fix homepage block table ID columns.
 *
 * Root cause: The homepage block tables were created with "id" serial (integer),
 * but Payload CMS generates MongoDB-style string ObjectIDs for block items.
 * This caused insert failures when trying to save pages with these blocks.
 *
 * Fix: Change ID columns from serial to varchar to match Payload's expectations.
 * Must drop foreign key constraints first, then alter columns, then recreate constraints.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Step 1: Drop all foreign key constraints on junction tables
  // These reference the block table IDs that we need to alter
  await db.execute(sql`
    ALTER TABLE "pages_blocks_featured_itineraries_rels"
    DROP CONSTRAINT IF EXISTS "pages_blocks_featured_itineraries_rels_parent_fk";
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_destination_highlights_rels"
    DROP CONSTRAINT IF EXISTS "pages_blocks_destination_highlights_rels_parent_fk";
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_featured_properties_rels"
    DROP CONSTRAINT IF EXISTS "pages_blocks_featured_properties_rels_parent_fk";
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_itineraries_rels"
    DROP CONSTRAINT IF EXISTS "_pages_v_blocks_featured_itineraries_rels_parent_fk";
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_destination_highlights_rels"
    DROP CONSTRAINT IF EXISTS "_pages_v_blocks_destination_highlights_rels_parent_fk";
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_properties_rels"
    DROP CONSTRAINT IF EXISTS "_pages_v_blocks_featured_properties_rels_parent_fk";
  `)

  // Step 2: Fix pages_blocks_home_hero
  await db.execute(sql`
    ALTER TABLE "pages_blocks_home_hero"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_home_hero"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  // Fix pages_blocks_featured_itineraries
  await db.execute(sql`
    ALTER TABLE "pages_blocks_featured_itineraries"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_featured_itineraries"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  // Fix pages_blocks_destination_highlights
  await db.execute(sql`
    ALTER TABLE "pages_blocks_destination_highlights"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_destination_highlights"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  // Fix pages_blocks_value_proposition
  await db.execute(sql`
    ALTER TABLE "pages_blocks_value_proposition"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_value_proposition"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  // Fix pages_blocks_testimonial
  await db.execute(sql`
    ALTER TABLE "pages_blocks_testimonial"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_testimonial"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  // Fix pages_blocks_featured_properties
  await db.execute(sql`
    ALTER TABLE "pages_blocks_featured_properties"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_featured_properties"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  // Step 3: Fix the version tables (_pages_v_blocks_*)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_home_hero"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_home_hero"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_itineraries"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_itineraries"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_destination_highlights"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_destination_highlights"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_value_proposition"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_value_proposition"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_testimonial"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_testimonial"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_properties"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_properties"
    ALTER COLUMN "id" TYPE varchar USING id::varchar;
  `)

  // Step 4: Fix the junction tables - parent_id references the block id which is now varchar
  await db.execute(sql`
    ALTER TABLE "pages_blocks_featured_itineraries_rels"
    ALTER COLUMN "parent_id" TYPE varchar USING parent_id::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "pages_blocks_destination_highlights_rels"
    ALTER COLUMN "parent_id" TYPE varchar USING parent_id::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "pages_blocks_featured_properties_rels"
    ALTER COLUMN "parent_id" TYPE varchar USING parent_id::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_itineraries_rels"
    ALTER COLUMN "parent_id" TYPE varchar USING parent_id::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_destination_highlights_rels"
    ALTER COLUMN "parent_id" TYPE varchar USING parent_id::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_properties_rels"
    ALTER COLUMN "parent_id" TYPE varchar USING parent_id::varchar;
  `)

  // Step 5: Recreate foreign key constraints with varchar types
  await db.execute(sql`
    ALTER TABLE "pages_blocks_featured_itineraries_rels"
    ADD CONSTRAINT "pages_blocks_featured_itineraries_rels_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "pages_blocks_featured_itineraries"("id") ON DELETE CASCADE;
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_destination_highlights_rels"
    ADD CONSTRAINT "pages_blocks_destination_highlights_rels_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "pages_blocks_destination_highlights"("id") ON DELETE CASCADE;
  `)
  await db.execute(sql`
    ALTER TABLE "pages_blocks_featured_properties_rels"
    ADD CONSTRAINT "pages_blocks_featured_properties_rels_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "pages_blocks_featured_properties"("id") ON DELETE CASCADE;
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_itineraries_rels"
    ADD CONSTRAINT "_pages_v_blocks_featured_itineraries_rels_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "_pages_v_blocks_featured_itineraries"("id") ON DELETE CASCADE;
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_destination_highlights_rels"
    ADD CONSTRAINT "_pages_v_blocks_destination_highlights_rels_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "_pages_v_blocks_destination_highlights"("id") ON DELETE CASCADE;
  `)
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_properties_rels"
    ADD CONSTRAINT "_pages_v_blocks_featured_properties_rels_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "_pages_v_blocks_featured_properties"("id") ON DELETE CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // This migration cannot be easily reversed as data would be lost
  // when converting varchar IDs back to integers
}
