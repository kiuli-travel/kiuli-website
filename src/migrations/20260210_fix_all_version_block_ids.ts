import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration to fix ALL version block table ID columns.
 *
 * These tables have integer IDs with serial sequences but Payload 3.x expects
 * varchar IDs with UUID defaults for version block tables.
 *
 * Must handle FK constraints properly:
 * - _pages_v_blocks_content has child table _pages_v_blocks_content_columns
 * - _pages_v_blocks_cta has child table _pages_v_blocks_cta_links
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Tables with children (have FK constraints TO them)
  const tablesWithChildren = [
    {
      parent: '_pages_v_blocks_content',
      children: ['_pages_v_blocks_content_columns'],
      fkColumn: '_parent_id',
    },
    {
      parent: '_pages_v_blocks_cta',
      children: ['_pages_v_blocks_cta_links'],
      fkColumn: '_parent_id',
    },
  ]

  // Simple tables without FK constraints
  const simpleTables = [
    '_itineraries_v_blocks_activity',
    '_itineraries_v_blocks_stay',
    '_itineraries_v_blocks_transfer',
    '_pages_v_blocks_archive',
    '_pages_v_blocks_form_block',
    '_pages_v_blocks_media_block',
  ]

  // Handle tables with children first
  for (const config of tablesWithChildren) {
    // Step 1: Drop FK constraints from children
    for (const child of config.children) {
      await db.execute(sql.raw(`
        ALTER TABLE "${child}"
        DROP CONSTRAINT IF EXISTS "${child}_parent_id_fk"
      `))
    }

    // Step 2: Fix parent table
    await db.execute(sql.raw(`
      ALTER TABLE "${config.parent}"
      ALTER COLUMN "id" DROP DEFAULT
    `))
    await db.execute(sql.raw(`
      ALTER TABLE "${config.parent}"
      ALTER COLUMN "id" TYPE varchar USING id::varchar
    `))
    await db.execute(sql.raw(`
      ALTER TABLE "${config.parent}"
      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar
    `))
    await db.execute(sql.raw(`
      DROP SEQUENCE IF EXISTS "${config.parent}_id_seq" CASCADE
    `))

    // Step 3: Fix child tables FK column type
    for (const child of config.children) {
      await db.execute(sql.raw(`
        ALTER TABLE "${child}"
        ALTER COLUMN "${config.fkColumn}" TYPE varchar USING ${config.fkColumn}::varchar
      `))
    }

    // Step 4: Recreate FK constraints
    for (const child of config.children) {
      await db.execute(sql.raw(`
        ALTER TABLE "${child}"
        ADD CONSTRAINT "${child}_parent_id_fk"
        FOREIGN KEY ("${config.fkColumn}") REFERENCES "${config.parent}"("id") ON DELETE CASCADE
      `))
    }
  }

  // Handle simple tables
  for (const table of simpleTables) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" DROP DEFAULT
    `))
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" TYPE varchar USING id::varchar
    `))
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar
    `))
    await db.execute(sql.raw(`
      DROP SEQUENCE IF EXISTS "${table}_id_seq" CASCADE
    `))
  }

  // Handle child tables that also need their IDs fixed
  const childTables = [
    '_pages_v_blocks_content_columns',
    '_pages_v_blocks_cta_links',
  ]

  for (const table of childTables) {
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" DROP DEFAULT
    `))
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" TYPE varchar USING id::varchar
    `))
    await db.execute(sql.raw(`
      ALTER TABLE "${table}"
      ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar
    `))
    await db.execute(sql.raw(`
      DROP SEQUENCE IF EXISTS "${table}_id_seq" CASCADE
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverting this migration is complex and may cause data loss
  // In practice, we don't expect to revert this
  console.log('Revert not implemented - manual intervention required')
}
