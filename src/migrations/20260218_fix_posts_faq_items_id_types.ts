import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix posts_faq_items and related table ID column types.
 *
 * Payload CMS 3.76+ uses different ID strategies for main vs version array tables:
 * - Main tables (posts_faq_items, posts_populated_authors): varchar IDs (hex strings from Payload)
 * - Version tables (_posts_v_version_faq_items, _posts_v_version_populated_authors): serial (integer auto-increment)
 *
 * This migration is IDEMPOTENT: it checks current column types before altering.
 * Safe to run on fresh databases, already-applied databases, or partial states.
 */

async function getColumnType(
  db: MigrateUpArgs['db'],
  tableName: string,
  columnName: string,
): Promise<{ dataType: string; hasDefault: boolean }> {
  const result = await db.execute(sql`
    SELECT data_type, column_default
    FROM information_schema.columns
    WHERE table_name = ${tableName} AND column_name = ${columnName}
  `)
  const row = (result as any).rows?.[0]
  if (!row) throw new Error(`Column ${tableName}.${columnName} not found`)
  return {
    dataType: row.data_type,
    hasDefault: row.column_default !== null,
  }
}

async function ensureVarchar(
  db: MigrateUpArgs['db'],
  tableName: string,
): Promise<void> {
  const { dataType } = await getColumnType(db, tableName, 'id')
  if (dataType === 'character varying') {
    console.log(`  ${tableName}.id already varchar — skip`)
    return
  }
  console.log(`  ${tableName}.id is ${dataType} — converting to varchar`)
  await db.execute(sql.raw(`ALTER TABLE "${tableName}" ALTER COLUMN "id" DROP DEFAULT`))
  await db.execute(sql.raw(`ALTER TABLE "${tableName}" ALTER COLUMN "id" SET DATA TYPE varchar USING "id"::varchar`))
  await db.execute(sql.raw(`DROP SEQUENCE IF EXISTS "${tableName}_id_seq"`))
}

async function ensureSerial(
  db: MigrateUpArgs['db'],
  tableName: string,
): Promise<void> {
  const { dataType, hasDefault } = await getColumnType(db, tableName, 'id')
  if (dataType === 'integer' && hasDefault) {
    console.log(`  ${tableName}.id already integer with default — skip`)
    return
  }
  if (dataType !== 'integer') {
    console.log(`  ${tableName}.id is ${dataType} — converting to integer`)
    // Must handle existing varchar values: set to sequential integers
    // First, add a temp sequence
    const seqName = `${tableName}_id_seq`
    await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS "${seqName}"`))
    await db.execute(sql.raw(`
      ALTER TABLE "${tableName}" ALTER COLUMN "id" SET DATA TYPE integer
      USING nextval('"${seqName}"')
    `))
    await db.execute(sql.raw(`ALTER SEQUENCE "${seqName}" OWNED BY "${tableName}"."id"`))
    await db.execute(sql.raw(`
      SELECT setval('"${seqName}"', COALESCE((SELECT MAX("id") FROM "${tableName}"), 0) + 1, false)
    `))
    await db.execute(sql.raw(`ALTER TABLE "${tableName}" ALTER COLUMN "id" SET DEFAULT nextval('"${seqName}"')`))
  } else {
    // Integer but no default — add the sequence
    console.log(`  ${tableName}.id is integer but missing default — adding sequence`)
    const seqName = `${tableName}_id_seq`
    await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS "${seqName}" OWNED BY "${tableName}"."id"`))
    await db.execute(sql.raw(`
      SELECT setval('"${seqName}"', COALESCE((SELECT MAX("id") FROM "${tableName}"), 0) + 1, false)
    `))
    await db.execute(sql.raw(`ALTER TABLE "${tableName}" ALTER COLUMN "id" SET DEFAULT nextval('"${seqName}"')`))
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  console.log('Fixing posts array table ID types (idempotent)...')

  // Main tables: should be varchar
  console.log('Main tables → varchar:')
  await ensureVarchar(db, 'posts_faq_items')
  await ensureVarchar(db, 'posts_populated_authors')

  // Version tables: should be serial (integer + auto-increment)
  console.log('Version tables → serial:')
  await ensureSerial(db, '_posts_v_version_faq_items')
  await ensureSerial(db, '_posts_v_version_populated_authors')

  console.log('Done.')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Revert: main tables back to serial, version tables back to varchar
  // (This is the pre-fix state, which was broken, but down() restores it)
  console.log('Reverting posts array table ID types...')

  // Main tables back to serial
  await ensureSerial(db, 'posts_faq_items')
  await ensureSerial(db, 'posts_populated_authors')

  // Version tables back to varchar
  await ensureVarchar(db, '_posts_v_version_faq_items')
  await ensureVarchar(db, '_posts_v_version_populated_authors')
}
