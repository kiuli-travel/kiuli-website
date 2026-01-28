import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add videoScrapedFromSource column to track if videos were found during scraping
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "video_scraped_from_source" boolean DEFAULT false;
  `);

  // Add videoScrapingError column to store error messages
  await db.execute(sql`
    ALTER TABLE "itineraries"
    ADD COLUMN IF NOT EXISTS "video_scraping_error" varchar;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "video_scraped_from_source";
  `);
  await db.execute(sql`
    ALTER TABLE "itineraries" DROP COLUMN IF EXISTS "video_scraping_error";
  `);
}
