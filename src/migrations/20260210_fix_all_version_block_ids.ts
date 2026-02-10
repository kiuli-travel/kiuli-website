import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration to fix ALL version block table ID columns.
 *
 * These tables have integer IDs with serial sequences but Payload 3.x expects
 * varchar IDs with UUID defaults for version block tables.
 *
 * Tables to fix:
 * - _itineraries_v_blocks_activity
 * - _itineraries_v_blocks_stay
 * - _itineraries_v_blocks_transfer
 * - _pages_v_blocks_archive
 * - _pages_v_blocks_content
 * - _pages_v_blocks_content_columns
 * - _pages_v_blocks_cta
 * - _pages_v_blocks_cta_links
 * - _pages_v_blocks_form_block
 * - _pages_v_blocks_media_block
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const tablesToFix = [
    '_itineraries_v_blocks_activity',
    '_itineraries_v_blocks_stay',
    '_itineraries_v_blocks_transfer',
    '_pages_v_blocks_archive',
    '_pages_v_blocks_content',
    '_pages_v_blocks_content_columns',
    '_pages_v_blocks_cta',
    '_pages_v_blocks_cta_links',
    '_pages_v_blocks_form_block',
    '_pages_v_blocks_media_block',
  ]

  for (const table of tablesToFix) {
    // Step 1: Drop the default (which references the sequence)
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" DROP DEFAULT
    `))

    // Step 2: Convert existing integer IDs to varchar
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" TYPE varchar USING id::varchar
    `))

    // Step 3: Add UUID default for new rows
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar
    `))

    // Step 4: Drop the orphaned sequence
    await db.execute(sql.raw(`
      DROP SEQUENCE IF EXISTS "${table}_id_seq" CASCADE
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const tablesToRevert = [
    '_itineraries_v_blocks_activity',
    '_itineraries_v_blocks_stay',
    '_itineraries_v_blocks_transfer',
    '_pages_v_blocks_archive',
    '_pages_v_blocks_content',
    '_pages_v_blocks_content_columns',
    '_pages_v_blocks_cta',
    '_pages_v_blocks_cta_links',
    '_pages_v_blocks_form_block',
    '_pages_v_blocks_media_block',
  ]

  for (const table of tablesToRevert) {
    // Recreate sequence
    await db.execute(sql.raw(`
      CREATE SEQUENCE IF NOT EXISTS "${table}_id_seq"
    `))

    // Drop UUID default
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" DROP DEFAULT
    `))

    // Convert varchar IDs back to integer (will fail if UUIDs exist)
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" TYPE integer USING id::integer
    `))

    // Restore serial default
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" SET DEFAULT nextval('${table}_id_seq'::regclass)
    `))
  }
}
