import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add reviewed column to stay blocks
  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_stay"
    ADD COLUMN IF NOT EXISTS "reviewed" boolean DEFAULT false;
  `);

  // Add reviewed column to activity blocks
  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_activity"
    ADD COLUMN IF NOT EXISTS "reviewed" boolean DEFAULT false;
  `);

  // Add reviewed column to transfer blocks
  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_transfer"
    ADD COLUMN IF NOT EXISTS "reviewed" boolean DEFAULT false;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_stay" DROP COLUMN IF EXISTS "reviewed";
  `);
  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_activity" DROP COLUMN IF EXISTS "reviewed";
  `);
  await db.execute(sql`
    ALTER TABLE "itineraries_blocks_transfer" DROP COLUMN IF EXISTS "reviewed";
  `);
}
