import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activities_rels" ADD COLUMN "itineraries_id" integer;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_itineraries_fk" FOREIGN KEY ("itineraries_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "activities_rels_itineraries_id_idx" ON "activities_rels" USING btree ("itineraries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activities_rels" DROP CONSTRAINT "activities_rels_itineraries_fk";
  
  DROP INDEX "activities_rels_itineraries_id_idx";
  ALTER TABLE "activities_rels" DROP COLUMN "itineraries_id";`)
}
