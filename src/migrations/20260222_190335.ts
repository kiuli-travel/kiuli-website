import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."prop_obs_price_tier" AS ENUM('ultra_premium', 'premium', 'mid_luxury', 'accessible_luxury');
  CREATE TYPE "public"."prop_pairing_pos" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum_properties_availability_source" AS ENUM('none', 'resconnect', 'direct');
  CREATE TYPE "public"."enum__properties_v_version_availability_source" AS ENUM('none', 'resconnect', 'direct');
  CREATE TYPE "public"."enum_activities_suitability" AS ENUM('family', 'couples', 'honeymoon', 'group', 'solo', 'accessible');
  CREATE TYPE "public"."enum_activities_type" AS ENUM('game_drive', 'walking_safari', 'gorilla_trek', 'chimpanzee_trek', 'balloon_flight', 'boat_safari', 'canoe_safari', 'horseback_safari', 'cultural_visit', 'bush_dinner', 'sundowner', 'fishing', 'snorkeling', 'diving', 'spa', 'photography', 'birding', 'conservation_experience', 'community_visit', 'helicopter_flight', 'other');
  CREATE TYPE "public"."enum_activities_best_time_of_day" AS ENUM('early_morning', 'morning', 'midday', 'afternoon', 'evening', 'night', 'any');
  CREATE TYPE "public"."enum_activities_fitness_level" AS ENUM('low', 'moderate', 'high');
  CREATE TYPE "public"."enum_transfer_routes_mode" AS ENUM('flight', 'road', 'boat', 'helicopter', 'charter');
  CREATE TYPE "public"."enum_itinerary_patterns_pax_type" AS ENUM('family', 'couple', 'group', 'solo', 'unknown');
  CREATE TYPE "public"."enum_itinerary_patterns_price_tier" AS ENUM('ultra_premium', 'premium', 'mid_luxury', 'accessible_luxury');
  CREATE TABLE "properties_external_ids_res_request_accomm_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "properties_room_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"max_pax" numeric,
  	"image_id" integer
  );
  
  CREATE TABLE "prop_price_obs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"itinerary_id_id" integer,
  	"price_per_night" numeric,
  	"price_tier" "prop_obs_price_tier",
  	"observed_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "properties_accumulated_data_common_pairings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"property_id" integer,
  	"position" "prop_pairing_pos",
  	"count" numeric DEFAULT 1
  );
  
  CREATE TABLE "_properties_v_version_external_ids_res_request_accomm_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"name" varchar
  );
  
  CREATE TABLE "_properties_v_version_room_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"max_pax" numeric,
  	"image_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_prop_price_obs_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"itinerary_id_id" integer,
  	"price_per_night" numeric,
  	"price_tier" "prop_obs_price_tier",
  	"observed_at" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_properties_v_version_accumulated_data_common_pairings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"property_id" integer,
  	"position" "prop_pairing_pos",
  	"count" numeric DEFAULT 1,
  	"_uuid" varchar
  );
  
  CREATE TABLE "activities_suitability" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_activities_suitability",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "activities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"type" "enum_activities_type",
  	"description" jsonb,
  	"typical_duration" varchar,
  	"best_time_of_day" "enum_activities_best_time_of_day",
  	"minimum_age" numeric,
  	"fitness_level" "enum_activities_fitness_level",
  	"wetu_content_entity_id" numeric,
  	"observation_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "activities_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"destinations_id" integer,
  	"properties_id" integer
  );
  
  CREATE TABLE "transfer_routes_airlines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"go7_airline" boolean DEFAULT false,
  	"duffel_airline" boolean DEFAULT false
  );
  
  CREATE TABLE "transfer_routes_observations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"itinerary_id_id" integer,
  	"departure_time" varchar,
  	"arrival_time" varchar,
  	"airline" varchar,
  	"date_observed" timestamp(3) with time zone
  );
  
  CREATE TABLE "transfer_routes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"from_destination_id" integer,
  	"to_destination_id" integer,
  	"from_property_id" integer,
  	"to_property_id" integer,
  	"mode" "enum_transfer_routes_mode" NOT NULL,
  	"typical_duration_minutes" numeric,
  	"distance_km" numeric,
  	"from_coordinates_latitude" numeric,
  	"from_coordinates_longitude" numeric,
  	"to_coordinates_latitude" numeric,
  	"to_coordinates_longitude" numeric,
  	"observation_count" numeric DEFAULT 0,
  	"wetu_route_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "itinerary_patterns_property_sequence" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"property_id" integer NOT NULL,
  	"nights" numeric,
  	"order" numeric,
  	"room_type" varchar
  );
  
  CREATE TABLE "itinerary_patterns_transfer_sequence" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"route_id" integer,
  	"after_property" numeric,
  	"mode" varchar
  );
  
  CREATE TABLE "itinerary_patterns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source_itinerary_id" integer NOT NULL,
  	"extracted_at" timestamp(3) with time zone,
  	"total_nights" numeric,
  	"pax_type" "enum_itinerary_patterns_pax_type" DEFAULT 'unknown',
  	"adults" numeric,
  	"children" numeric,
  	"price_total" numeric,
  	"currency" varchar DEFAULT 'USD',
  	"price_per_night_avg" numeric,
  	"price_tier" "enum_itinerary_patterns_price_tier",
  	"travel_month" numeric,
  	"travel_year" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "itinerary_patterns_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"destinations_id" integer
  );
  
  ALTER TABLE "properties" ADD COLUMN "external_ids_itrvl_supplier_code" varchar;
  ALTER TABLE "properties" ADD COLUMN "external_ids_itrvl_property_name" varchar;
  ALTER TABLE "properties" ADD COLUMN "external_ids_res_request_property_id" varchar;
  ALTER TABLE "properties" ADD COLUMN "external_ids_res_request_principal_id" varchar;
  ALTER TABLE "properties" ADD COLUMN "external_ids_wetu_content_entity_id" numeric;
  ALTER TABLE "properties" ADD COLUMN "canonical_content_coordinates_latitude" numeric;
  ALTER TABLE "properties" ADD COLUMN "canonical_content_coordinates_longitude" numeric;
  ALTER TABLE "properties" ADD COLUMN "canonical_content_contact_email" varchar;
  ALTER TABLE "properties" ADD COLUMN "canonical_content_contact_phone" varchar;
  ALTER TABLE "properties" ADD COLUMN "accumulated_data_price_positioning_observation_count" numeric DEFAULT 0;
  ALTER TABLE "properties" ADD COLUMN "availability_source" "enum_properties_availability_source" DEFAULT 'none';
  ALTER TABLE "_properties_v" ADD COLUMN "version_external_ids_itrvl_supplier_code" varchar;
  ALTER TABLE "_properties_v" ADD COLUMN "version_external_ids_itrvl_property_name" varchar;
  ALTER TABLE "_properties_v" ADD COLUMN "version_external_ids_res_request_property_id" varchar;
  ALTER TABLE "_properties_v" ADD COLUMN "version_external_ids_res_request_principal_id" varchar;
  ALTER TABLE "_properties_v" ADD COLUMN "version_external_ids_wetu_content_entity_id" numeric;
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_coordinates_latitude" numeric;
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_coordinates_longitude" numeric;
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_contact_email" varchar;
  ALTER TABLE "_properties_v" ADD COLUMN "version_canonical_content_contact_phone" varchar;
  ALTER TABLE "_properties_v" ADD COLUMN "version_accumulated_data_price_positioning_observation_count" numeric DEFAULT 0;
  ALTER TABLE "_properties_v" ADD COLUMN "version_availability_source" "enum__properties_v_version_availability_source" DEFAULT 'none';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activities_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "transfer_routes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "itinerary_patterns_id" integer;
  ALTER TABLE "properties_external_ids_res_request_accomm_types" ADD CONSTRAINT "properties_external_ids_res_request_accomm_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_room_types" ADD CONSTRAINT "properties_room_types_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties_room_types" ADD CONSTRAINT "properties_room_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "prop_price_obs" ADD CONSTRAINT "prop_price_obs_itinerary_id_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "prop_price_obs" ADD CONSTRAINT "prop_price_obs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_accumulated_data_common_pairings" ADD CONSTRAINT "properties_accumulated_data_common_pairings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties_accumulated_data_common_pairings" ADD CONSTRAINT "properties_accumulated_data_common_pairings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_properties_v_version_external_ids_res_request_accomm_types" ADD CONSTRAINT "_properties_v_version_external_ids_res_request_accomm_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_properties_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_properties_v_version_room_types" ADD CONSTRAINT "_properties_v_version_room_types_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_properties_v_version_room_types" ADD CONSTRAINT "_properties_v_version_room_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_properties_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_prop_price_obs_v" ADD CONSTRAINT "_prop_price_obs_v_itinerary_id_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_prop_price_obs_v" ADD CONSTRAINT "_prop_price_obs_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_properties_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_properties_v_version_accumulated_data_common_pairings" ADD CONSTRAINT "_properties_v_version_accumulated_data_common_pairings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_properties_v_version_accumulated_data_common_pairings" ADD CONSTRAINT "_properties_v_version_accumulated_data_common_pairings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_properties_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_suitability" ADD CONSTRAINT "activities_suitability_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_destinations_fk" FOREIGN KEY ("destinations_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_properties_fk" FOREIGN KEY ("properties_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "transfer_routes_airlines" ADD CONSTRAINT "transfer_routes_airlines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."transfer_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "transfer_routes_observations" ADD CONSTRAINT "transfer_routes_observations_itinerary_id_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transfer_routes_observations" ADD CONSTRAINT "transfer_routes_observations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."transfer_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_from_destination_id_destinations_id_fk" FOREIGN KEY ("from_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_to_destination_id_destinations_id_fk" FOREIGN KEY ("to_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_from_property_id_properties_id_fk" FOREIGN KEY ("from_property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_to_property_id_properties_id_fk" FOREIGN KEY ("to_property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "itinerary_patterns_property_sequence" ADD CONSTRAINT "itinerary_patterns_property_sequence_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "itinerary_patterns_property_sequence" ADD CONSTRAINT "itinerary_patterns_property_sequence_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itinerary_patterns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itinerary_patterns_transfer_sequence" ADD CONSTRAINT "itinerary_patterns_transfer_sequence_route_id_transfer_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."transfer_routes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "itinerary_patterns_transfer_sequence" ADD CONSTRAINT "itinerary_patterns_transfer_sequence_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itinerary_patterns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itinerary_patterns" ADD CONSTRAINT "itinerary_patterns_source_itinerary_id_itineraries_id_fk" FOREIGN KEY ("source_itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "itinerary_patterns_rels" ADD CONSTRAINT "itinerary_patterns_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."itinerary_patterns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itinerary_patterns_rels" ADD CONSTRAINT "itinerary_patterns_rels_destinations_fk" FOREIGN KEY ("destinations_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "properties_external_ids_res_request_accomm_types_order_idx" ON "properties_external_ids_res_request_accomm_types" USING btree ("_order");
  CREATE INDEX "properties_external_ids_res_request_accomm_types_parent_id_idx" ON "properties_external_ids_res_request_accomm_types" USING btree ("_parent_id");
  CREATE INDEX "properties_room_types_order_idx" ON "properties_room_types" USING btree ("_order");
  CREATE INDEX "properties_room_types_parent_id_idx" ON "properties_room_types" USING btree ("_parent_id");
  CREATE INDEX "properties_room_types_image_idx" ON "properties_room_types" USING btree ("image_id");
  CREATE INDEX "prop_price_obs_order_idx" ON "prop_price_obs" USING btree ("_order");
  CREATE INDEX "prop_price_obs_parent_id_idx" ON "prop_price_obs" USING btree ("_parent_id");
  CREATE INDEX "prop_price_obs_itinerary_id_idx" ON "prop_price_obs" USING btree ("itinerary_id_id");
  CREATE INDEX "properties_accumulated_data_common_pairings_order_idx" ON "properties_accumulated_data_common_pairings" USING btree ("_order");
  CREATE INDEX "properties_accumulated_data_common_pairings_parent_id_idx" ON "properties_accumulated_data_common_pairings" USING btree ("_parent_id");
  CREATE INDEX "properties_accumulated_data_common_pairings_property_idx" ON "properties_accumulated_data_common_pairings" USING btree ("property_id");
  CREATE INDEX "_properties_v_version_external_ids_res_request_accomm_types_order_idx" ON "_properties_v_version_external_ids_res_request_accomm_types" USING btree ("_order");
  CREATE INDEX "_properties_v_version_external_ids_res_request_accomm_types_parent_id_idx" ON "_properties_v_version_external_ids_res_request_accomm_types" USING btree ("_parent_id");
  CREATE INDEX "_properties_v_version_room_types_order_idx" ON "_properties_v_version_room_types" USING btree ("_order");
  CREATE INDEX "_properties_v_version_room_types_parent_id_idx" ON "_properties_v_version_room_types" USING btree ("_parent_id");
  CREATE INDEX "_properties_v_version_room_types_image_idx" ON "_properties_v_version_room_types" USING btree ("image_id");
  CREATE INDEX "_prop_price_obs_v_order_idx" ON "_prop_price_obs_v" USING btree ("_order");
  CREATE INDEX "_prop_price_obs_v_parent_id_idx" ON "_prop_price_obs_v" USING btree ("_parent_id");
  CREATE INDEX "_prop_price_obs_v_itinerary_id_idx" ON "_prop_price_obs_v" USING btree ("itinerary_id_id");
  CREATE INDEX "_properties_v_version_accumulated_data_common_pairings_order_idx" ON "_properties_v_version_accumulated_data_common_pairings" USING btree ("_order");
  CREATE INDEX "_properties_v_version_accumulated_data_common_pairings_parent_id_idx" ON "_properties_v_version_accumulated_data_common_pairings" USING btree ("_parent_id");
  CREATE INDEX "_properties_v_version_accumulated_data_common_pairings_p_idx" ON "_properties_v_version_accumulated_data_common_pairings" USING btree ("property_id");
  CREATE INDEX "activities_suitability_order_idx" ON "activities_suitability" USING btree ("order");
  CREATE INDEX "activities_suitability_parent_idx" ON "activities_suitability" USING btree ("parent_id");
  CREATE UNIQUE INDEX "activities_slug_idx" ON "activities" USING btree ("slug");
  CREATE INDEX "activities_updated_at_idx" ON "activities" USING btree ("updated_at");
  CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");
  CREATE INDEX "activities_rels_order_idx" ON "activities_rels" USING btree ("order");
  CREATE INDEX "activities_rels_parent_idx" ON "activities_rels" USING btree ("parent_id");
  CREATE INDEX "activities_rels_path_idx" ON "activities_rels" USING btree ("path");
  CREATE INDEX "activities_rels_destinations_id_idx" ON "activities_rels" USING btree ("destinations_id");
  CREATE INDEX "activities_rels_properties_id_idx" ON "activities_rels" USING btree ("properties_id");
  CREATE INDEX "transfer_routes_airlines_order_idx" ON "transfer_routes_airlines" USING btree ("_order");
  CREATE INDEX "transfer_routes_airlines_parent_id_idx" ON "transfer_routes_airlines" USING btree ("_parent_id");
  CREATE INDEX "transfer_routes_observations_order_idx" ON "transfer_routes_observations" USING btree ("_order");
  CREATE INDEX "transfer_routes_observations_parent_id_idx" ON "transfer_routes_observations" USING btree ("_parent_id");
  CREATE INDEX "transfer_routes_observations_itinerary_id_idx" ON "transfer_routes_observations" USING btree ("itinerary_id_id");
  CREATE UNIQUE INDEX "transfer_routes_slug_idx" ON "transfer_routes" USING btree ("slug");
  CREATE INDEX "transfer_routes_from_destination_idx" ON "transfer_routes" USING btree ("from_destination_id");
  CREATE INDEX "transfer_routes_to_destination_idx" ON "transfer_routes" USING btree ("to_destination_id");
  CREATE INDEX "transfer_routes_from_property_idx" ON "transfer_routes" USING btree ("from_property_id");
  CREATE INDEX "transfer_routes_to_property_idx" ON "transfer_routes" USING btree ("to_property_id");
  CREATE INDEX "transfer_routes_updated_at_idx" ON "transfer_routes" USING btree ("updated_at");
  CREATE INDEX "transfer_routes_created_at_idx" ON "transfer_routes" USING btree ("created_at");
  CREATE INDEX "itinerary_patterns_property_sequence_order_idx" ON "itinerary_patterns_property_sequence" USING btree ("_order");
  CREATE INDEX "itinerary_patterns_property_sequence_parent_id_idx" ON "itinerary_patterns_property_sequence" USING btree ("_parent_id");
  CREATE INDEX "itinerary_patterns_property_sequence_property_idx" ON "itinerary_patterns_property_sequence" USING btree ("property_id");
  CREATE INDEX "itinerary_patterns_transfer_sequence_order_idx" ON "itinerary_patterns_transfer_sequence" USING btree ("_order");
  CREATE INDEX "itinerary_patterns_transfer_sequence_parent_id_idx" ON "itinerary_patterns_transfer_sequence" USING btree ("_parent_id");
  CREATE INDEX "itinerary_patterns_transfer_sequence_route_idx" ON "itinerary_patterns_transfer_sequence" USING btree ("route_id");
  CREATE UNIQUE INDEX "itinerary_patterns_source_itinerary_idx" ON "itinerary_patterns" USING btree ("source_itinerary_id");
  CREATE INDEX "itinerary_patterns_updated_at_idx" ON "itinerary_patterns" USING btree ("updated_at");
  CREATE INDEX "itinerary_patterns_created_at_idx" ON "itinerary_patterns" USING btree ("created_at");
  CREATE INDEX "itinerary_patterns_rels_order_idx" ON "itinerary_patterns_rels" USING btree ("order");
  CREATE INDEX "itinerary_patterns_rels_parent_idx" ON "itinerary_patterns_rels" USING btree ("parent_id");
  CREATE INDEX "itinerary_patterns_rels_path_idx" ON "itinerary_patterns_rels" USING btree ("path");
  CREATE INDEX "itinerary_patterns_rels_destinations_id_idx" ON "itinerary_patterns_rels" USING btree ("destinations_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activities_fk" FOREIGN KEY ("activities_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transfer_routes_fk" FOREIGN KEY ("transfer_routes_id") REFERENCES "public"."transfer_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_itinerary_patterns_fk" FOREIGN KEY ("itinerary_patterns_id") REFERENCES "public"."itinerary_patterns"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("activities_id");
  CREATE INDEX "payload_locked_documents_rels_transfer_routes_id_idx" ON "payload_locked_documents_rels" USING btree ("transfer_routes_id");
  CREATE INDEX "payload_locked_documents_rels_itinerary_patterns_id_idx" ON "payload_locked_documents_rels" USING btree ("itinerary_patterns_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "properties_external_ids_res_request_accomm_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "properties_room_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "prop_price_obs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "properties_accumulated_data_common_pairings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_properties_v_version_external_ids_res_request_accomm_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_properties_v_version_room_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_prop_price_obs_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_properties_v_version_accumulated_data_common_pairings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "activities_suitability" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "activities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "activities_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "transfer_routes_airlines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "transfer_routes_observations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "transfer_routes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itinerary_patterns_property_sequence" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itinerary_patterns_transfer_sequence" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itinerary_patterns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itinerary_patterns_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "properties_external_ids_res_request_accomm_types" CASCADE;
  DROP TABLE "properties_room_types" CASCADE;
  DROP TABLE "prop_price_obs" CASCADE;
  DROP TABLE "properties_accumulated_data_common_pairings" CASCADE;
  DROP TABLE "_properties_v_version_external_ids_res_request_accomm_types" CASCADE;
  DROP TABLE "_properties_v_version_room_types" CASCADE;
  DROP TABLE "_prop_price_obs_v" CASCADE;
  DROP TABLE "_properties_v_version_accumulated_data_common_pairings" CASCADE;
  DROP TABLE "activities_suitability" CASCADE;
  DROP TABLE "activities" CASCADE;
  DROP TABLE "activities_rels" CASCADE;
  DROP TABLE "transfer_routes_airlines" CASCADE;
  DROP TABLE "transfer_routes_observations" CASCADE;
  DROP TABLE "transfer_routes" CASCADE;
  DROP TABLE "itinerary_patterns_property_sequence" CASCADE;
  DROP TABLE "itinerary_patterns_transfer_sequence" CASCADE;
  DROP TABLE "itinerary_patterns" CASCADE;
  DROP TABLE "itinerary_patterns_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_activities_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transfer_routes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_itinerary_patterns_fk";
  
  DROP INDEX "payload_locked_documents_rels_activities_id_idx";
  DROP INDEX "payload_locked_documents_rels_transfer_routes_id_idx";
  DROP INDEX "payload_locked_documents_rels_itinerary_patterns_id_idx";
  ALTER TABLE "properties" DROP COLUMN "external_ids_itrvl_supplier_code";
  ALTER TABLE "properties" DROP COLUMN "external_ids_itrvl_property_name";
  ALTER TABLE "properties" DROP COLUMN "external_ids_res_request_property_id";
  ALTER TABLE "properties" DROP COLUMN "external_ids_res_request_principal_id";
  ALTER TABLE "properties" DROP COLUMN "external_ids_wetu_content_entity_id";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_coordinates_latitude";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_coordinates_longitude";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_contact_email";
  ALTER TABLE "properties" DROP COLUMN "canonical_content_contact_phone";
  ALTER TABLE "properties" DROP COLUMN "accumulated_data_price_positioning_observation_count";
  ALTER TABLE "properties" DROP COLUMN "availability_source";
  ALTER TABLE "_properties_v" DROP COLUMN "version_external_ids_itrvl_supplier_code";
  ALTER TABLE "_properties_v" DROP COLUMN "version_external_ids_itrvl_property_name";
  ALTER TABLE "_properties_v" DROP COLUMN "version_external_ids_res_request_property_id";
  ALTER TABLE "_properties_v" DROP COLUMN "version_external_ids_res_request_principal_id";
  ALTER TABLE "_properties_v" DROP COLUMN "version_external_ids_wetu_content_entity_id";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_coordinates_latitude";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_coordinates_longitude";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_contact_email";
  ALTER TABLE "_properties_v" DROP COLUMN "version_canonical_content_contact_phone";
  ALTER TABLE "_properties_v" DROP COLUMN "version_accumulated_data_price_positioning_observation_count";
  ALTER TABLE "_properties_v" DROP COLUMN "version_availability_source";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "activities_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "transfer_routes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "itinerary_patterns_id";
  DROP TYPE "public"."prop_obs_price_tier";
  DROP TYPE "public"."prop_pairing_pos";
  DROP TYPE "public"."enum_properties_availability_source";
  DROP TYPE "public"."enum__properties_v_version_availability_source";
  DROP TYPE "public"."enum_activities_suitability";
  DROP TYPE "public"."enum_activities_type";
  DROP TYPE "public"."enum_activities_best_time_of_day";
  DROP TYPE "public"."enum_activities_fitness_level";
  DROP TYPE "public"."enum_transfer_routes_mode";
  DROP TYPE "public"."enum_itinerary_patterns_pax_type";
  DROP TYPE "public"."enum_itinerary_patterns_price_tier";`)
}
