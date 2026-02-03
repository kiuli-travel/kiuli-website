import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // The schema changed from primaryInterest (single select) to interests (hasMany select).
  // The old primary_interest column still exists with NOT NULL. Make it nullable so
  // inserts that no longer populate it can succeed.
  await db.execute(sql`
    ALTER TABLE "inquiries"
    ALTER COLUMN "primary_interest" DROP NOT NULL;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "inquiries"
    ALTER COLUMN "primary_interest" SET NOT NULL;
  `);
}
