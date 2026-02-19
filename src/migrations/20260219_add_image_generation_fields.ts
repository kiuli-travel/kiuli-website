import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add generation metadata columns to media table and articleImages to content_projects.
 *
 * Phase 14a: Image Library polish
 * - media.generation_prompt (text) — the prompt used to generate the image
 * - media.generation_model (varchar) — the model that generated it
 * - media.generated_at (timestamptz) — when it was generated
 * - content_projects.article_images (jsonb) — inline image placements
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
  // Media: generation_prompt
  if (!(await columnExists(db, 'media', 'generation_prompt'))) {
    await db.execute(sql`ALTER TABLE "media" ADD COLUMN "generation_prompt" text`)
  }

  // Media: generation_model
  if (!(await columnExists(db, 'media', 'generation_model'))) {
    await db.execute(sql`ALTER TABLE "media" ADD COLUMN "generation_model" varchar`)
  }

  // Media: generated_at
  if (!(await columnExists(db, 'media', 'generated_at'))) {
    await db.execute(sql`ALTER TABLE "media" ADD COLUMN "generated_at" timestamp(3) with time zone`)
  }

  // ContentProjects: article_images
  if (!(await columnExists(db, 'content_projects', 'article_images'))) {
    await db.execute(sql`ALTER TABLE "content_projects" ADD COLUMN "article_images" jsonb`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await columnExists(db, 'media', 'generation_prompt')) {
    await db.execute(sql`ALTER TABLE "media" DROP COLUMN "generation_prompt"`)
  }
  if (await columnExists(db, 'media', 'generation_model')) {
    await db.execute(sql`ALTER TABLE "media" DROP COLUMN "generation_model"`)
  }
  if (await columnExists(db, 'media', 'generated_at')) {
    await db.execute(sql`ALTER TABLE "media" DROP COLUMN "generated_at"`)
  }
  if (await columnExists(db, 'content_projects', 'article_images')) {
    await db.execute(sql`ALTER TABLE "content_projects" DROP COLUMN "article_images"`)
  }
}
