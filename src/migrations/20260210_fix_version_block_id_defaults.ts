import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration to add UUID defaults to version block table ID columns.
 *
 * Root cause: The previous migration changed version block table ID columns
 * from serial (auto-generating integers) to varchar without a default.
 * Payload expects the database to auto-generate IDs for version tables.
 *
 * Fix: Add gen_random_uuid()::varchar as the default for these columns.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add UUID defaults to version block tables
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_home_hero"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_itineraries"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_destination_highlights"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_value_proposition"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_testimonial"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_properties"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Remove the defaults
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_home_hero"
    ALTER COLUMN "id" DROP DEFAULT;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_itineraries"
    ALTER COLUMN "id" DROP DEFAULT;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_destination_highlights"
    ALTER COLUMN "id" DROP DEFAULT;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_value_proposition"
    ALTER COLUMN "id" DROP DEFAULT;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_testimonial"
    ALTER COLUMN "id" DROP DEFAULT;
  `)

  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_featured_properties"
    ALTER COLUMN "id" DROP DEFAULT;
  `)
}
