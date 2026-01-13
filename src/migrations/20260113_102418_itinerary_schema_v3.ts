import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_itineraries_blocks_transfer_type" AS ENUM('flight', 'road', 'boat');
  CREATE TYPE "public"."enum__itineraries_v_blocks_transfer_type" AS ENUM('flight', 'road', 'boat');
  CREATE TABLE "itineraries_overview_countries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"country" varchar
  );
  
  CREATE TABLE "itineraries_overview_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"highlight" varchar
  );
  
  CREATE TABLE "itineraries_blocks_stay" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"accommodation_name" varchar,
  	"description" jsonb,
  	"nights" numeric,
  	"location" varchar,
  	"country" varchar,
  	"inclusions" jsonb,
  	"room_type" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "itineraries_blocks_activity" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "itineraries_blocks_transfer" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_itineraries_blocks_transfer_type",
  	"title" varchar,
  	"from" varchar,
  	"to" varchar,
  	"description" jsonb,
  	"departure_time" varchar,
  	"arrival_time" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "itineraries_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day_number" numeric,
  	"date" timestamp(3) with time zone,
  	"title" varchar,
  	"location" varchar
  );
  
  CREATE TABLE "itineraries_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb
  );
  
  CREATE TABLE "_itineraries_v_version_overview_countries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"country" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_itineraries_v_version_overview_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"highlight" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_itineraries_v_blocks_stay" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"accommodation_name" varchar,
  	"description" jsonb,
  	"nights" numeric,
  	"location" varchar,
  	"country" varchar,
  	"inclusions" jsonb,
  	"room_type" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_itineraries_v_blocks_activity" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_itineraries_v_blocks_transfer" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum__itineraries_v_blocks_transfer_type",
  	"title" varchar,
  	"from" varchar,
  	"to" varchar,
  	"description" jsonb,
  	"departure_time" varchar,
  	"arrival_time" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_itineraries_v_version_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"day_number" numeric,
  	"date" timestamp(3) with time zone,
  	"title" varchar,
  	"location" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_itineraries_v_version_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb,
  	"_uuid" varchar
  );
  
  ALTER TABLE "media" ADD COLUMN "original_s3_key" varchar;
  ALTER TABLE "media" ADD COLUMN "imgix_url" varchar;
  ALTER TABLE "itineraries" ADD COLUMN "slug" varchar;
  ALTER TABLE "itineraries" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "itineraries" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "itineraries" ADD COLUMN "hero_image_id" integer;
  ALTER TABLE "itineraries" ADD COLUMN "overview_summary" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "overview_nights" numeric;
  ALTER TABLE "itineraries" ADD COLUMN "investment_level_from_price" numeric;
  ALTER TABLE "itineraries" ADD COLUMN "investment_level_to_price" numeric;
  ALTER TABLE "itineraries" ADD COLUMN "investment_level_currency" varchar DEFAULT 'USD';
  ALTER TABLE "itineraries" ADD COLUMN "investment_level_includes" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "why_kiuli" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "source_itrvl_url" varchar;
  ALTER TABLE "itineraries" ADD COLUMN "source_last_scraped_at" timestamp(3) with time zone;
  ALTER TABLE "itineraries" ADD COLUMN "source_raw_data" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_slug" varchar;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_meta_title" varchar;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_meta_description" varchar;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_hero_image_id" integer;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_overview_summary" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_overview_nights" numeric;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_investment_level_from_price" numeric;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_investment_level_to_price" numeric;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_investment_level_currency" varchar DEFAULT 'USD';
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_investment_level_includes" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_why_kiuli" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_source_itrvl_url" varchar;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_source_last_scraped_at" timestamp(3) with time zone;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_source_raw_data" jsonb;
  ALTER TABLE "itineraries_overview_countries" ADD CONSTRAINT "itineraries_overview_countries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itineraries_overview_highlights" ADD CONSTRAINT "itineraries_overview_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itineraries_blocks_stay" ADD CONSTRAINT "itineraries_blocks_stay_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itineraries_blocks_activity" ADD CONSTRAINT "itineraries_blocks_activity_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itineraries_blocks_transfer" ADD CONSTRAINT "itineraries_blocks_transfer_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itineraries_days" ADD CONSTRAINT "itineraries_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itineraries_faq_items" ADD CONSTRAINT "itineraries_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_itineraries_v_version_overview_countries" ADD CONSTRAINT "_itineraries_v_version_overview_countries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_itineraries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_itineraries_v_version_overview_highlights" ADD CONSTRAINT "_itineraries_v_version_overview_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_itineraries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_itineraries_v_blocks_stay" ADD CONSTRAINT "_itineraries_v_blocks_stay_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_itineraries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_itineraries_v_blocks_activity" ADD CONSTRAINT "_itineraries_v_blocks_activity_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_itineraries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_itineraries_v_blocks_transfer" ADD CONSTRAINT "_itineraries_v_blocks_transfer_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_itineraries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_itineraries_v_version_days" ADD CONSTRAINT "_itineraries_v_version_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_itineraries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_itineraries_v_version_faq_items" ADD CONSTRAINT "_itineraries_v_version_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_itineraries_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "itineraries_overview_countries_order_idx" ON "itineraries_overview_countries" USING btree ("_order");
  CREATE INDEX "itineraries_overview_countries_parent_id_idx" ON "itineraries_overview_countries" USING btree ("_parent_id");
  CREATE INDEX "itineraries_overview_highlights_order_idx" ON "itineraries_overview_highlights" USING btree ("_order");
  CREATE INDEX "itineraries_overview_highlights_parent_id_idx" ON "itineraries_overview_highlights" USING btree ("_parent_id");
  CREATE INDEX "itineraries_blocks_stay_order_idx" ON "itineraries_blocks_stay" USING btree ("_order");
  CREATE INDEX "itineraries_blocks_stay_parent_id_idx" ON "itineraries_blocks_stay" USING btree ("_parent_id");
  CREATE INDEX "itineraries_blocks_stay_path_idx" ON "itineraries_blocks_stay" USING btree ("_path");
  CREATE INDEX "itineraries_blocks_activity_order_idx" ON "itineraries_blocks_activity" USING btree ("_order");
  CREATE INDEX "itineraries_blocks_activity_parent_id_idx" ON "itineraries_blocks_activity" USING btree ("_parent_id");
  CREATE INDEX "itineraries_blocks_activity_path_idx" ON "itineraries_blocks_activity" USING btree ("_path");
  CREATE INDEX "itineraries_blocks_transfer_order_idx" ON "itineraries_blocks_transfer" USING btree ("_order");
  CREATE INDEX "itineraries_blocks_transfer_parent_id_idx" ON "itineraries_blocks_transfer" USING btree ("_parent_id");
  CREATE INDEX "itineraries_blocks_transfer_path_idx" ON "itineraries_blocks_transfer" USING btree ("_path");
  CREATE INDEX "itineraries_days_order_idx" ON "itineraries_days" USING btree ("_order");
  CREATE INDEX "itineraries_days_parent_id_idx" ON "itineraries_days" USING btree ("_parent_id");
  CREATE INDEX "itineraries_faq_items_order_idx" ON "itineraries_faq_items" USING btree ("_order");
  CREATE INDEX "itineraries_faq_items_parent_id_idx" ON "itineraries_faq_items" USING btree ("_parent_id");
  CREATE INDEX "_itineraries_v_version_overview_countries_order_idx" ON "_itineraries_v_version_overview_countries" USING btree ("_order");
  CREATE INDEX "_itineraries_v_version_overview_countries_parent_id_idx" ON "_itineraries_v_version_overview_countries" USING btree ("_parent_id");
  CREATE INDEX "_itineraries_v_version_overview_highlights_order_idx" ON "_itineraries_v_version_overview_highlights" USING btree ("_order");
  CREATE INDEX "_itineraries_v_version_overview_highlights_parent_id_idx" ON "_itineraries_v_version_overview_highlights" USING btree ("_parent_id");
  CREATE INDEX "_itineraries_v_blocks_stay_order_idx" ON "_itineraries_v_blocks_stay" USING btree ("_order");
  CREATE INDEX "_itineraries_v_blocks_stay_parent_id_idx" ON "_itineraries_v_blocks_stay" USING btree ("_parent_id");
  CREATE INDEX "_itineraries_v_blocks_stay_path_idx" ON "_itineraries_v_blocks_stay" USING btree ("_path");
  CREATE INDEX "_itineraries_v_blocks_activity_order_idx" ON "_itineraries_v_blocks_activity" USING btree ("_order");
  CREATE INDEX "_itineraries_v_blocks_activity_parent_id_idx" ON "_itineraries_v_blocks_activity" USING btree ("_parent_id");
  CREATE INDEX "_itineraries_v_blocks_activity_path_idx" ON "_itineraries_v_blocks_activity" USING btree ("_path");
  CREATE INDEX "_itineraries_v_blocks_transfer_order_idx" ON "_itineraries_v_blocks_transfer" USING btree ("_order");
  CREATE INDEX "_itineraries_v_blocks_transfer_parent_id_idx" ON "_itineraries_v_blocks_transfer" USING btree ("_parent_id");
  CREATE INDEX "_itineraries_v_blocks_transfer_path_idx" ON "_itineraries_v_blocks_transfer" USING btree ("_path");
  CREATE INDEX "_itineraries_v_version_days_order_idx" ON "_itineraries_v_version_days" USING btree ("_order");
  CREATE INDEX "_itineraries_v_version_days_parent_id_idx" ON "_itineraries_v_version_days" USING btree ("_parent_id");
  CREATE INDEX "_itineraries_v_version_faq_items_order_idx" ON "_itineraries_v_version_faq_items" USING btree ("_order");
  CREATE INDEX "_itineraries_v_version_faq_items_parent_id_idx" ON "_itineraries_v_version_faq_items" USING btree ("_parent_id");
  ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_itineraries_v" ADD CONSTRAINT "_itineraries_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "itineraries_slug_idx" ON "itineraries" USING btree ("slug");
  CREATE INDEX "itineraries_hero_image_idx" ON "itineraries" USING btree ("hero_image_id");
  CREATE INDEX "_itineraries_v_version_version_slug_idx" ON "_itineraries_v" USING btree ("version_slug");
  CREATE INDEX "_itineraries_v_version_version_hero_image_idx" ON "_itineraries_v" USING btree ("version_hero_image_id");
  ALTER TABLE "itineraries" DROP COLUMN "price";
  ALTER TABLE "itineraries" DROP COLUMN "price_formatted";
  ALTER TABLE "itineraries" DROP COLUMN "raw_itinerary";
  ALTER TABLE "itineraries" DROP COLUMN "enhanced_itinerary";
  ALTER TABLE "itineraries" DROP COLUMN "faq";
  ALTER TABLE "itineraries" DROP COLUMN "google_failure_log";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_price";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_price_formatted";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_raw_itinerary";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_enhanced_itinerary";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_faq";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_google_failure_log";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "itineraries_overview_countries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itineraries_overview_highlights" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itineraries_blocks_stay" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itineraries_blocks_activity" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itineraries_blocks_transfer" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itineraries_days" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itineraries_faq_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_itineraries_v_version_overview_countries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_itineraries_v_version_overview_highlights" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_itineraries_v_blocks_stay" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_itineraries_v_blocks_activity" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_itineraries_v_blocks_transfer" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_itineraries_v_version_days" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_itineraries_v_version_faq_items" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "itineraries_overview_countries" CASCADE;
  DROP TABLE "itineraries_overview_highlights" CASCADE;
  DROP TABLE "itineraries_blocks_stay" CASCADE;
  DROP TABLE "itineraries_blocks_activity" CASCADE;
  DROP TABLE "itineraries_blocks_transfer" CASCADE;
  DROP TABLE "itineraries_days" CASCADE;
  DROP TABLE "itineraries_faq_items" CASCADE;
  DROP TABLE "_itineraries_v_version_overview_countries" CASCADE;
  DROP TABLE "_itineraries_v_version_overview_highlights" CASCADE;
  DROP TABLE "_itineraries_v_blocks_stay" CASCADE;
  DROP TABLE "_itineraries_v_blocks_activity" CASCADE;
  DROP TABLE "_itineraries_v_blocks_transfer" CASCADE;
  DROP TABLE "_itineraries_v_version_days" CASCADE;
  DROP TABLE "_itineraries_v_version_faq_items" CASCADE;
  ALTER TABLE "itineraries" DROP CONSTRAINT "itineraries_hero_image_id_media_id_fk";
  
  ALTER TABLE "_itineraries_v" DROP CONSTRAINT "_itineraries_v_version_hero_image_id_media_id_fk";
  
  DROP INDEX "itineraries_slug_idx";
  DROP INDEX "itineraries_hero_image_idx";
  DROP INDEX "_itineraries_v_version_version_slug_idx";
  DROP INDEX "_itineraries_v_version_version_hero_image_idx";
  ALTER TABLE "itineraries" ADD COLUMN "price" numeric;
  ALTER TABLE "itineraries" ADD COLUMN "price_formatted" varchar;
  ALTER TABLE "itineraries" ADD COLUMN "raw_itinerary" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "enhanced_itinerary" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "faq" varchar;
  ALTER TABLE "itineraries" ADD COLUMN "google_failure_log" varchar;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_price" numeric;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_price_formatted" varchar;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_raw_itinerary" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_enhanced_itinerary" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_faq" varchar;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_google_failure_log" varchar;
  ALTER TABLE "media" DROP COLUMN "original_s3_key";
  ALTER TABLE "media" DROP COLUMN "imgix_url";
  ALTER TABLE "itineraries" DROP COLUMN "slug";
  ALTER TABLE "itineraries" DROP COLUMN "meta_title";
  ALTER TABLE "itineraries" DROP COLUMN "meta_description";
  ALTER TABLE "itineraries" DROP COLUMN "hero_image_id";
  ALTER TABLE "itineraries" DROP COLUMN "overview_summary";
  ALTER TABLE "itineraries" DROP COLUMN "overview_nights";
  ALTER TABLE "itineraries" DROP COLUMN "investment_level_from_price";
  ALTER TABLE "itineraries" DROP COLUMN "investment_level_to_price";
  ALTER TABLE "itineraries" DROP COLUMN "investment_level_currency";
  ALTER TABLE "itineraries" DROP COLUMN "investment_level_includes";
  ALTER TABLE "itineraries" DROP COLUMN "why_kiuli";
  ALTER TABLE "itineraries" DROP COLUMN "source_itrvl_url";
  ALTER TABLE "itineraries" DROP COLUMN "source_last_scraped_at";
  ALTER TABLE "itineraries" DROP COLUMN "source_raw_data";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_slug";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_meta_title";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_meta_description";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_hero_image_id";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_overview_summary";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_overview_nights";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_investment_level_from_price";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_investment_level_to_price";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_investment_level_currency";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_investment_level_includes";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_why_kiuli";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_source_itrvl_url";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_source_last_scraped_at";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_source_raw_data";
  DROP TYPE "public"."enum_itineraries_blocks_transfer_type";
  DROP TYPE "public"."enum__itineraries_v_blocks_transfer_type";`)
}
