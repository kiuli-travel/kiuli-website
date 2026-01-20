import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add reviewed column to FAQ items table
  await db.execute(sql`
    ALTER TABLE "itineraries_faq_items"
    ADD COLUMN IF NOT EXISTS "reviewed" boolean DEFAULT false;
  `);

  // Add to versions table as well
  await db.execute(sql`
    ALTER TABLE "_itineraries_v_version_faq_items"
    ADD COLUMN IF NOT EXISTS "reviewed" boolean DEFAULT false;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "itineraries_faq_items"
    DROP COLUMN IF EXISTS "reviewed";
  `);
  await db.execute(sql`
    ALTER TABLE "_itineraries_v_version_faq_items"
    DROP COLUMN IF EXISTS "reviewed";
  `);
}
