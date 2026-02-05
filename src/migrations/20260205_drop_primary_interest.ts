import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop the primary_interest column that was removed from Inquiries collection
  // This was replaced by the interests hasMany select field
  await db.execute(sql`
    ALTER TABLE "inquiries" DROP COLUMN IF EXISTS "primary_interest";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Re-add the column if needed (unlikely to be used)
  await db.execute(sql`
    ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "primary_interest" varchar;
  `);
}
