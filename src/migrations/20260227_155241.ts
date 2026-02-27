import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "itineraries" ADD COLUMN "investment_level_callout_itrvl" varchar;
  ALTER TABLE "itineraries" ADD COLUMN "investment_level_callout_enhanced" varchar;
  ALTER TABLE "itineraries" ADD COLUMN "investment_level_callout_reviewed" boolean DEFAULT false;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_investment_level_callout_itrvl" varchar;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_investment_level_callout_enhanced" varchar;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_investment_level_callout_reviewed" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "itineraries" DROP COLUMN "investment_level_callout_itrvl";
  ALTER TABLE "itineraries" DROP COLUMN "investment_level_callout_enhanced";
  ALTER TABLE "itineraries" DROP COLUMN "investment_level_callout_reviewed";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_investment_level_callout_itrvl";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_investment_level_callout_enhanced";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_investment_level_callout_reviewed";`)
}
