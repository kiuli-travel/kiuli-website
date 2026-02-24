import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."prop_obs_pax_type" AS ENUM('family', 'couple', 'group', 'solo', 'unknown');
  CREATE TYPE "public"."enum_properties_accumulated_data_suitability" AS ENUM('family', 'couples', 'honeymoon', 'group', 'solo', 'multigenerational', 'accessible');
  CREATE TYPE "public"."enum_properties_canonical_content_source" AS ENUM('scraper', 'wetu', 'manual');
  CREATE TYPE "public"."prop_pp_band" AS ENUM('ultra_premium', 'premium', 'mid_luxury', 'accessible_luxury');
  CREATE TYPE "public"."enum_properties_availability_agent_relationship" AS ENUM('contracted', 'registered', 'none');
  CREATE TYPE "public"."enum_properties_availability_rate_visibility" AS ENUM('net', 'rack', 'special', 'unknown');
  CREATE TYPE "public"."enum__properties_v_version_accumulated_data_suitability" AS ENUM('family', 'couples', 'honeymoon', 'group', 'solo', 'multigenerational', 'accessible');
  CREATE TYPE "public"."enum__properties_v_version_canonical_content_source" AS ENUM('scraper', 'wetu', 'manual');
  CREATE TYPE "public"."enum__properties_v_version_availability_agent_relationship" AS ENUM('contracted', 'registered', 'none');
  CREATE TYPE "public"."enum__properties_v_version_availability_rate_visibility" AS ENUM('net', 'rack', 'special', 'unknown');
  CREATE TABLE "properties_room_types_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "prop_room_obs" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"itinerary_id_id" integer,
  	"nights_booked" numeric,
  	"price_observed" numeric,
  	"currency" varchar DEFAULT 'USD',
  	"date_observed" timestamp(3) with time zone
  );
  
  CREATE TABLE "properties_accumulated_data_suitability" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_properties_accumulated_data_suitability",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "properties_accumulated_data_activity_patterns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"activity" varchar,
  	"frequency" numeric DEFAULT 1
  );
  
  CREATE TABLE "_properties_v_version_room_types_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_prop_room_obs_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"itinerary_id_id" integer,
  	"nights_booked" numeric,
  	"price_observed" numeric,
  	"currency" varchar DEFAULT 'USD',
  	"date_observed" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_properties_v_version_accumulated_data_suitability" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__properties_v_version_accumulated_data_suitability",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_properties_v_version_accumulated_data_activity_patterns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"activity" varchar,
  	"frequency" numeric DEFAULT 1,
  	"_uuid" varchar
  );
  
  ALTER TABLE "properties_room_types" DROP CONSTRAINT "properties_room_types_image_id_media_id_fk";
  
  ALTER TABLE "_properties_v_version_room_types" DROP CONSTRAINT "_properties_v_version_room_types_image_id_media_id_fk";
  
  ALTER TABLE "activities" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_activities_type";
  CREATE TYPE "public"."enum_activities_type" AS ENUM('game_drive', 'walking_safari', 'gorilla_trek', 'chimpanzee_trek', 'balloon_flight', 'boat_safari', 'canoe_safari', 'horseback_safari', 'cultural_visit', 'bush_dinner', 'sundowner', 'fishing', 'snorkeling', 'diving', 'spa', 'photography', 'birding', 'conservation_experience', 'community_visit', 'helicopter_flight');
  ALTER TABLE "activities" ALTER COLUMN "type" SET DATA TYPE "public"."enum_activities_type" USING "type"::"public"."enum_activities_type";
  DROP INDEX "properties_room_types_image_idx";
  DROP INDEX "_properties_v_version_room_types_image_idx";
  ALTER TABLE "properties_external_ids_res_request_accomm_types" ADD COLUMN "wetu_content_entity_item_id" varchar;
  ALTER TABLE "properties_room_types" ADD COLUMN "res_request_id" varchar;
  ALTER TABLE "properties_room_types" ADD COLUMN "wetu_item_id" varchar;
  ALTER TABLE "properties_room_types" ADD COLUMN "description" jsonb;
  ALTER TABLE "properties_room_types" ADD COLUMN "max_occupancy" numeric;
  ALTER TABLE "prop_price_obs" ADD COLUMN "source" varchar;
  ALTER TABLE "prop_price_obs" ADD COLUMN "pax_type" "prop_obs_pax_type";
  ALTER TABLE "prop_price_obs" ADD COLUMN "room_type" varchar;
  ALTER TABLE "properties" ADD COLUMN "external_ids_wetu_content_rating" numeric;
  ALTER TABLE "properties" ADD COLUMN "canonical_content_source" "enum_properties_canonical_content_source" DEFAULT 'scraper';
  ALTER TABLE "properties" ADD COLUMN "canonical_content_last_synced" timestamp(3) with time zone;
  ALTER TABLE "properties" ADD COLUMN "canonical_content_description" jsonb;
  ALTER TABLE "properties" ADD COLUMN "canonical_content_address" varchar;
  ALTER TABLE "properties" ADD COLUMN "canonical_content_website" varchar;
  ALTER TABLE "properties" ADD COLUMN "canonical_content_star_rating" numeric;
  ALTER TABLE "properties" ADD COLUMN "canonical_content_total_rooms" numeric;
  ALTER TABLE "properties" ADD COLUMN "accumulated_data_observation_count" numeric DEFAULT 0;
  ALTER TABLE "properties" ADD COLUMN "accumulated_data_last_observed_at" timestamp(3) with time zone;
  ALTER TABLE "properties" ADD COLUMN "accumulated_data_typical_nights_median" numeric;
  ALTER TABLE "properties" ADD COLUMN "accumulated_data_typical_nights_min" numeric;
  ALTER TABLE "properties" ADD COLUMN "accumulated_data_typical_nights_max" numeric;
  ALTER TABLE "properties" ADD COLUMN "accumulated_data_price_positioning_band" "prop_pp_band";
  ALTER TABLE "properties" ADD COLUMN "accumulated_data_price_positioning_avg_per_night_usd" numeric;
  ALTER TABLE "properties" ADD COLUMN "accumulated_data_inclusion_patterns" jsonb;
  ALTER TABLE "properties" ADD COLUMN "availability_last_checked" timestamp(3) with time zone;
  ALTER TABLE "properties" ADD COLUMN "availability_agent_relationship" "enum_properties_availability_agent_relationship" DEFAULT 'none';
  ALTER TABLE "properties" ADD COLUMN "availability_rate_visibility" "enum_properties_availability_rate_visibility" DEFAULT 'unknown';
  ALTER TABLE "properties" ADD COLUMN "availability_cache_policy_ttl_minutes" numeric DEFAULT 60;
  ALTER TABLE "properties" ADD COLUMN "availability_cache_policy_check_on_draft" boolean DEFAULT false;
  ALTER TABLE "_properties_v_version_external_ids_res_request_accomm_types" ADD COLUMN "wetu_content_entity_item_id" varchar;
  ALTER TABLE "_properties_v_version_room_types" ADD COLUMN "res_request_id" varchar;
  ALTER TABLE "_properties_v_version_room_types" ADD COLUMN "wetu_item_id" varchar;
  ALTER TABLE "_properties_v_version_room_types" ADD COLUMN "description" jsonb;
  ALTER TABLE "_properties_v_version_room_types" ADD COLUMN "max_occupancy" numeric;
  ALTER TABLE "_prop_price_obs_v" ADD COLUMN "source" varchar;
  ALTER TABLE "_prop_price_obs_v" ADD COLUMN "pax_type" "prop_obs_pax_type";
  ALTER TABLE "_prop_price_obs_v" ADD COLUMN "room_type" varchar;
  ALTER TABLE "_properties_v" ADD COLUMN "version_external_ids_wetu_content_rating" numeric;
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_source" "enum__properties_v_version_canonical_content_source" DEFAULT 'scraper';
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_last_synced" timestamp(3) with time zone;
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_description" jsonb;
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_address" varchar;
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_website" varchar;
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_star_rating" numeric;
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_total_rooms" numeric;
  ALTER TABLE "_properties_v" ADD COLUMN "version_accumulated_data_observation_count" numeric DEFAULT 0;
  ALTER TABLE "_properties_v" ADD COLUMN "version_accumulated_data_last_observed_at" timestamp(3) with time zone;
  ALTER TABLE "_properties_v" ADD COLUMN "version_accumulated_data_typical_nights_median" numeric;
  ALTER TABLE "_properties_v" ADD COLUMN "version_accumulated_data_typical_nights_min" numeric;
  ALTER TABLE "_properties_v" ADD COLUMN "version_accumulated_data_typical_nights_max" numeric;
  ALTER TABLE "_properties_v" ADD COLUMN "version_accumulated_data_price_positioning_band" "prop_pp_band";
  ALTER TABLE "_properties_v" ADD COLUMN "version_accumulated_data_price_positioning_avg_per_night_usd" numeric;
  ALTER TABLE "_properties_v" ADD COLUMN "version_accumulated_data_inclusion_patterns" jsonb;
  ALTER TABLE "_properties_v" ADD COLUMN "version_availability_last_checked" timestamp(3) with time zone;
  ALTER TABLE "_properties_v" ADD COLUMN "version_availability_agent_relationship" "enum__properties_v_version_availability_agent_relationship" DEFAULT 'none';
  ALTER TABLE "_properties_v" ADD COLUMN "version_availability_rate_visibility" "enum__properties_v_version_availability_rate_visibility" DEFAULT 'unknown';
  ALTER TABLE "_properties_v" ADD COLUMN "version_availability_cache_policy_ttl_minutes" numeric DEFAULT 60;
  ALTER TABLE "_properties_v" ADD COLUMN "version_availability_cache_policy_check_on_draft" boolean DEFAULT false;
  ALTER TABLE "properties_room_types_images" ADD CONSTRAINT "properties_room_types_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties_room_types_images" ADD CONSTRAINT "properties_room_types_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties_room_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "prop_room_obs" ADD CONSTRAINT "prop_room_obs_itinerary_id_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "prop_room_obs" ADD CONSTRAINT "prop_room_obs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties_room_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_accumulated_data_suitability" ADD CONSTRAINT "properties_accumulated_data_suitability_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_accumulated_data_activity_patterns" ADD CONSTRAINT "properties_accumulated_data_activity_patterns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_properties_v_version_room_types_images" ADD CONSTRAINT "_properties_v_version_room_types_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_properties_v_version_room_types_images" ADD CONSTRAINT "_properties_v_version_room_types_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_properties_v_version_room_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_prop_room_obs_v" ADD CONSTRAINT "_prop_room_obs_v_itinerary_id_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_prop_room_obs_v" ADD CONSTRAINT "_prop_room_obs_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_properties_v_version_room_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_properties_v_version_accumulated_data_suitability" ADD CONSTRAINT "_properties_v_version_accumulated_data_suitability_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_properties_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_properties_v_version_accumulated_data_activity_patterns" ADD CONSTRAINT "_properties_v_version_accumulated_data_activity_patterns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_properties_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "properties_room_types_images_order_idx" ON "properties_room_types_images" USING btree ("_order");
  CREATE INDEX "properties_room_types_images_parent_id_idx" ON "properties_room_types_images" USING btree ("_parent_id");
  CREATE INDEX "properties_room_types_images_image_idx" ON "properties_room_types_images" USING btree ("image_id");
  CREATE INDEX "prop_room_obs_order_idx" ON "prop_room_obs" USING btree ("_order");
  CREATE INDEX "prop_room_obs_parent_id_idx" ON "prop_room_obs" USING btree ("_parent_id");
  CREATE INDEX "prop_room_obs_itinerary_id_idx" ON "prop_room_obs" USING btree ("itinerary_id_id");
  CREATE INDEX "properties_accumulated_data_suitability_order_idx" ON "properties_accumulated_data_suitability" USING btree ("order");
  CREATE INDEX "properties_accumulated_data_suitability_parent_idx" ON "properties_accumulated_data_suitability" USING btree ("parent_id");
  CREATE INDEX "properties_accumulated_data_activity_patterns_order_idx" ON "properties_accumulated_data_activity_patterns" USING btree ("_order");
  CREATE INDEX "properties_accumulated_data_activity_patterns_parent_id_idx" ON "properties_accumulated_data_activity_patterns" USING btree ("_parent_id");
  CREATE INDEX "_properties_v_version_room_types_images_order_idx" ON "_properties_v_version_room_types_images" USING btree ("_order");
  CREATE INDEX "_properties_v_version_room_types_images_parent_id_idx" ON "_properties_v_version_room_types_images" USING btree ("_parent_id");
  CREATE INDEX "_properties_v_version_room_types_images_image_idx" ON "_properties_v_version_room_types_images" USING btree ("image_id");
  CREATE INDEX "_prop_room_obs_v_order_idx" ON "_prop_room_obs_v" USING btree ("_order");
  CREATE INDEX "_prop_room_obs_v_parent_id_idx" ON "_prop_room_obs_v" USING btree ("_parent_id");
  CREATE INDEX "_prop_room_obs_v_itinerary_id_idx" ON "_prop_room_obs_v" USING btree ("itinerary_id_id");
  CREATE INDEX "_properties_v_version_accumulated_data_suitability_order_idx" ON "_properties_v_version_accumulated_data_suitability" USING btree ("order");
  CREATE INDEX "_properties_v_version_accumulated_data_suitability_parent_idx" ON "_properties_v_version_accumulated_data_suitability" USING btree ("parent_id");
  CREATE INDEX "_properties_v_version_accumulated_data_activity_patterns_order_idx" ON "_properties_v_version_accumulated_data_activity_patterns" USING btree ("_order");
  CREATE INDEX "_properties_v_version_accumulated_data_activity_patterns_parent_id_idx" ON "_properties_v_version_accumulated_data_activity_patterns" USING btree ("_parent_id");
  ALTER TABLE "properties_room_types" DROP COLUMN "max_pax";
  ALTER TABLE "properties_room_types" DROP COLUMN "image_id";
  ALTER TABLE "_properties_v_version_room_types" DROP COLUMN "max_pax";
  ALTER TABLE "_properties_v_version_room_types" DROP COLUMN "image_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_activities_type" ADD VALUE 'other';
  ALTER TABLE "properties_room_types_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "prop_room_obs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "properties_accumulated_data_suitability" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "properties_accumulated_data_activity_patterns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_properties_v_version_room_types_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_prop_room_obs_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_properties_v_version_accumulated_data_suitability" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_properties_v_version_accumulated_data_activity_patterns" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "properties_room_types_images" CASCADE;
  DROP TABLE "prop_room_obs" CASCADE;
  DROP TABLE "properties_accumulated_data_suitability" CASCADE;
  DROP TABLE "properties_accumulated_data_activity_patterns" CASCADE;
  DROP TABLE "_properties_v_version_room_types_images" CASCADE;
  DROP TABLE "_prop_room_obs_v" CASCADE;
  DROP TABLE "_properties_v_version_accumulated_data_suitability" CASCADE;
  DROP TABLE "_properties_v_version_accumulated_data_activity_patterns" CASCADE;
  ALTER TABLE "properties_room_types" ADD COLUMN "max_pax" numeric;
  ALTER TABLE "properties_room_types" ADD COLUMN "image_id" integer;
  ALTER TABLE "_properties_v_version_room_types" ADD COLUMN "max_pax" numeric;
  ALTER TABLE "_properties_v_version_room_types" ADD COLUMN "image_id" integer;
  ALTER TABLE "properties_room_types" ADD CONSTRAINT "properties_room_types_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_properties_v_version_room_types" ADD CONSTRAINT "_properties_v_version_room_types_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "properties_room_types_image_idx" ON "properties_room_types" USING btree ("image_id");
  CREATE INDEX "_properties_v_version_room_types_image_idx" ON "_properties_v_version_room_types" USING btree ("image_id");
  ALTER TABLE "properties_external_ids_res_request_accomm_types" DROP COLUMN "wetu_content_entity_item_id";
  ALTER TABLE "properties_room_types" DROP COLUMN "res_request_id";
  ALTER TABLE "properties_room_types" DROP COLUMN "wetu_item_id";
  ALTER TABLE "properties_room_types" DROP COLUMN "description";
  ALTER TABLE "properties_room_types" DROP COLUMN "max_occupancy";
  ALTER TABLE "prop_price_obs" DROP COLUMN "source";
  ALTER TABLE "prop_price_obs" DROP COLUMN "pax_type";
  ALTER TABLE "prop_price_obs" DROP COLUMN "room_type";
  ALTER TABLE "properties" DROP COLUMN "external_ids_wetu_content_rating";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_source";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_last_synced";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_description";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_address";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_website";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_star_rating";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_total_rooms";
  ALTER TABLE "properties" DROP COLUMN "accumulated_data_observation_count";
  ALTER TABLE "properties" DROP COLUMN "accumulated_data_last_observed_at";
  ALTER TABLE "properties" DROP COLUMN "accumulated_data_typical_nights_median";
  ALTER TABLE "properties" DROP COLUMN "accumulated_data_typical_nights_min";
  ALTER TABLE "properties" DROP COLUMN "accumulated_data_typical_nights_max";
  ALTER TABLE "properties" DROP COLUMN "accumulated_data_price_positioning_band";
  ALTER TABLE "properties" DROP COLUMN "accumulated_data_price_positioning_avg_per_night_usd";
  ALTER TABLE "properties" DROP COLUMN "accumulated_data_inclusion_patterns";
  ALTER TABLE "properties" DROP COLUMN "availability_last_checked";
  ALTER TABLE "properties" DROP COLUMN "availability_agent_relationship";
  ALTER TABLE "properties" DROP COLUMN "availability_rate_visibility";
  ALTER TABLE "properties" DROP COLUMN "availability_cache_policy_ttl_minutes";
  ALTER TABLE "properties" DROP COLUMN "availability_cache_policy_check_on_draft";
  ALTER TABLE "_properties_v_version_external_ids_res_request_accomm_types" DROP COLUMN "wetu_content_entity_item_id";
  ALTER TABLE "_properties_v_version_room_types" DROP COLUMN "res_request_id";
  ALTER TABLE "_properties_v_version_room_types" DROP COLUMN "wetu_item_id";
  ALTER TABLE "_properties_v_version_room_types" DROP COLUMN "description";
  ALTER TABLE "_properties_v_version_room_types" DROP COLUMN "max_occupancy";
  ALTER TABLE "_prop_price_obs_v" DROP COLUMN "source";
  ALTER TABLE "_prop_price_obs_v" DROP COLUMN "pax_type";
  ALTER TABLE "_prop_price_obs_v" DROP COLUMN "room_type";
  ALTER TABLE "_properties_v" DROP COLUMN "version_external_ids_wetu_content_rating";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_source";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_last_synced";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_description";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_address";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_website";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_star_rating";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_total_rooms";
  ALTER TABLE "_properties_v" DROP COLUMN "version_accumulated_data_observation_count";
  ALTER TABLE "_properties_v" DROP COLUMN "version_accumulated_data_last_observed_at";
  ALTER TABLE "_properties_v" DROP COLUMN "version_accumulated_data_typical_nights_median";
  ALTER TABLE "_properties_v" DROP COLUMN "version_accumulated_data_typical_nights_min";
  ALTER TABLE "_properties_v" DROP COLUMN "version_accumulated_data_typical_nights_max";
  ALTER TABLE "_properties_v" DROP COLUMN "version_accumulated_data_price_positioning_band";
  ALTER TABLE "_properties_v" DROP COLUMN "version_accumulated_data_price_positioning_avg_per_night_usd";
  ALTER TABLE "_properties_v" DROP COLUMN "version_accumulated_data_inclusion_patterns";
  ALTER TABLE "_properties_v" DROP COLUMN "version_availability_last_checked";
  ALTER TABLE "_properties_v" DROP COLUMN "version_availability_agent_relationship";
  ALTER TABLE "_properties_v" DROP COLUMN "version_availability_rate_visibility";
  ALTER TABLE "_properties_v" DROP COLUMN "version_availability_cache_policy_ttl_minutes";
  ALTER TABLE "_properties_v" DROP COLUMN "version_availability_cache_policy_check_on_draft";
  DROP TYPE "public"."prop_obs_pax_type";
  DROP TYPE "public"."enum_properties_accumulated_data_suitability";
  DROP TYPE "public"."enum_properties_canonical_content_source";
  DROP TYPE "public"."prop_pp_band";
  DROP TYPE "public"."enum_properties_availability_agent_relationship";
  DROP TYPE "public"."enum_properties_availability_rate_visibility";
  DROP TYPE "public"."enum__properties_v_version_accumulated_data_suitability";
  DROP TYPE "public"."enum__properties_v_version_canonical_content_source";
  DROP TYPE "public"."enum__properties_v_version_availability_agent_relationship";
  DROP TYPE "public"."enum__properties_v_version_availability_rate_visibility";`)
}
