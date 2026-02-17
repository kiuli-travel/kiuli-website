import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add 6 richText content fields to destinations
  await db.execute(sql`
    ALTER TABLE "destinations"
    ADD COLUMN IF NOT EXISTS "why_choose" jsonb,
    ADD COLUMN IF NOT EXISTS "key_experiences" jsonb,
    ADD COLUMN IF NOT EXISTS "getting_there" jsonb,
    ADD COLUMN IF NOT EXISTS "health_safety" jsonb,
    ADD COLUMN IF NOT EXISTS "investment_expectation" jsonb,
    ADD COLUMN IF NOT EXISTS "top_lodges_content" jsonb;
  `)

  // Add corresponding version columns
  await db.execute(sql`
    ALTER TABLE "_destinations_v"
    ADD COLUMN IF NOT EXISTS "version_why_choose" jsonb,
    ADD COLUMN IF NOT EXISTS "version_key_experiences" jsonb,
    ADD COLUMN IF NOT EXISTS "version_getting_there" jsonb,
    ADD COLUMN IF NOT EXISTS "version_health_safety" jsonb,
    ADD COLUMN IF NOT EXISTS "version_investment_expectation" jsonb,
    ADD COLUMN IF NOT EXISTS "version_top_lodges_content" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "destinations"
    DROP COLUMN IF EXISTS "why_choose",
    DROP COLUMN IF EXISTS "key_experiences",
    DROP COLUMN IF EXISTS "getting_there",
    DROP COLUMN IF EXISTS "health_safety",
    DROP COLUMN IF EXISTS "investment_expectation",
    DROP COLUMN IF EXISTS "top_lodges_content";
  `)

  await db.execute(sql`
    ALTER TABLE "_destinations_v"
    DROP COLUMN IF EXISTS "version_why_choose",
    DROP COLUMN IF EXISTS "version_key_experiences",
    DROP COLUMN IF EXISTS "version_getting_there",
    DROP COLUMN IF EXISTS "version_health_safety",
    DROP COLUMN IF EXISTS "version_investment_expectation",
    DROP COLUMN IF EXISTS "version_top_lodges_content";
  `)
}
