import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop orphaned columns that were added but removed from schema
  // These columns exist in the database but are no longer defined in the Itineraries collection
  await db.execute(sql`
    ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "video_scraped_from_source";
  `);
  await db.execute(sql`
    ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "video_scraping_error";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Re-add columns if migration is rolled back
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "video_scraped_from_source" boolean DEFAULT false;
  `);
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "video_scraping_error" varchar;
  `);
}
