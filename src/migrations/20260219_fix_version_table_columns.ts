import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix version table columns missing from 20260219_add_image_generation_fields.
 *
 * The original migration added columns to `media` and `content_projects` but
 * not to their version tables (`_media_v` and `_content_projects_v`).
 * Any update that triggers a version insert crashes with missing column errors.
 *
 * Also backfills imgixUrl for generated images that have null imgix_url.
 *
 * IDEMPOTENT: checks column existence before adding.
 */

async function columnExists(
  db: MigrateUpArgs['db'],
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${tableName} AND column_name = ${columnName}
  `)
  return ((result as any).rows?.length ?? 0) > 0
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // _content_projects_v: version_article_images
  if (!(await columnExists(db, '_content_projects_v', 'version_article_images'))) {
    await db.execute(sql`ALTER TABLE "_content_projects_v" ADD COLUMN "version_article_images" jsonb`)
  }

  // _media_v: version_generation_prompt
  if (!(await columnExists(db, '_media_v', 'version_generation_prompt'))) {
    await db.execute(sql`ALTER TABLE "_media_v" ADD COLUMN "version_generation_prompt" text`)
  }

  // _media_v: version_generation_model
  if (!(await columnExists(db, '_media_v', 'version_generation_model'))) {
    await db.execute(sql`ALTER TABLE "_media_v" ADD COLUMN "version_generation_model" varchar`)
  }

  // _media_v: version_generated_at
  if (!(await columnExists(db, '_media_v', 'version_generated_at'))) {
    await db.execute(sql`ALTER TABLE "_media_v" ADD COLUMN "version_generated_at" timestamp(3) with time zone`)
  }

  // Backfill imgixUrl for generated images with null imgix_url
  await db.execute(sql`
    UPDATE media
    SET imgix_url = 'https://kiuli.imgix.net/' || filename || '?auto=format,compress&q=80'
    WHERE source_s3_key LIKE 'generated:%' AND imgix_url IS NULL AND filename IS NOT NULL
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, '_content_projects_v', 'version_article_images')) {
    await db.execute(sql`ALTER TABLE "_content_projects_v" DROP COLUMN "version_article_images"`)
  }
  if (await columnExists(db, '_media_v', 'version_generation_prompt')) {
    await db.execute(sql`ALTER TABLE "_media_v" DROP COLUMN "version_generation_prompt"`)
  }
  if (await columnExists(db, '_media_v', 'version_generation_model')) {
    await db.execute(sql`ALTER TABLE "_media_v" DROP COLUMN "version_generation_model"`)
  }
  if (await columnExists(db, '_media_v', 'version_generated_at')) {
    await db.execute(sql`ALTER TABLE "_media_v" DROP COLUMN "version_generated_at"`)
  }
}
