import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "inquiries"
    ADD COLUMN IF NOT EXISTS "contact_consent" boolean DEFAULT false;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "inquiries" DROP COLUMN IF EXISTS "contact_consent";
  `);
}
