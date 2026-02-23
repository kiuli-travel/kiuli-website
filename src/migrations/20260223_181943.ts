import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activities_booking_behaviour_availability" AS ENUM('always_included', 'on_demand', 'scheduled', 'seasonal', 'optional_extra');
  CREATE TYPE "public"."enum_airports_type" AS ENUM('international', 'domestic', 'airstrip');
  CREATE TYPE "public"."enum_service_items_category" AS ENUM('airport_service', 'park_fee', 'conservation_fee', 'departure_tax', 'accommodation_supplement', 'other');
  CREATE TYPE "public"."enum_service_items_service_direction" AS ENUM('arrival', 'departure', 'both', 'na');
  CREATE TYPE "public"."enum_service_items_service_level" AS ENUM('standard', 'premium', 'ultra_premium');
  CREATE TYPE "public"."enum_location_mappings_mappings_source_system" AS ENUM('itrvl', 'wetu', 'expert_africa', 'any', 'manual');
  CREATE TYPE "public"."enum_location_mappings_mappings_resolved_as" AS ENUM('destination', 'property', 'airport', 'ignore');
  CREATE TABLE "properties_accumulated_data_seasonality_data" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"month" numeric,
  	"observation_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "_properties_v_version_accumulated_data_seasonality_data" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"month" numeric,
  	"observation_count" numeric DEFAULT 0,
  	"_uuid" varchar
  );
  
  CREATE TABLE "airports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"iata_code" varchar,
  	"icao_code" varchar,
  	"type" "enum_airports_type" NOT NULL,
  	"city" varchar,
  	"country_id" integer NOT NULL,
  	"nearest_destination_id" integer,
  	"services_has_international_flights" boolean DEFAULT false,
  	"services_has_domestic_scheduled_flights" boolean DEFAULT false,
  	"services_charter_only" boolean DEFAULT false,
  	"coordinates_latitude" numeric,
  	"coordinates_longitude" numeric,
  	"observation_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "airports_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"airports_id" integer
  );
  
  CREATE TABLE "service_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"category" "enum_service_items_category" NOT NULL,
  	"service_direction" "enum_service_items_service_direction" DEFAULT 'na' NOT NULL,
  	"service_level" "enum_service_items_service_level" NOT NULL,
  	"associated_airport_id" integer,
  	"associated_destination_id" integer,
  	"is_inclusion_indicator" boolean DEFAULT true,
  	"observation_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "service_items_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"itineraries_id" integer
  );
  
  CREATE TABLE "location_mappings_mappings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"external_string" varchar NOT NULL,
  	"source_system" "enum_location_mappings_mappings_source_system" NOT NULL,
  	"resolved_as" "enum_location_mappings_mappings_resolved_as" NOT NULL,
  	"destination_id" integer,
  	"property_id" integer,
  	"airport_id" integer,
  	"notes" varchar
  );
  
  CREATE TABLE "location_mappings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "destination_name_mappings_mappings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "destination_name_mappings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "destination_name_mappings_mappings" CASCADE;
  DROP TABLE "destination_name_mappings" CASCADE;
  ALTER TABLE "activities" ADD COLUMN "booking_behaviour_requires_advance_booking" boolean DEFAULT false;
  ALTER TABLE "activities" ADD COLUMN "booking_behaviour_availability" "enum_activities_booking_behaviour_availability" DEFAULT 'always_included';
  ALTER TABLE "activities" ADD COLUMN "booking_behaviour_minimum_lead_days" numeric;
  ALTER TABLE "activities" ADD COLUMN "booking_behaviour_maximum_group_size" numeric;
  ALTER TABLE "activities" ADD COLUMN "booking_behaviour_is_included_in_tariff" boolean DEFAULT true;
  ALTER TABLE "activities" ADD COLUMN "booking_behaviour_typical_additional_cost" varchar;
  ALTER TABLE "transfer_routes" ADD COLUMN "from_airport_id" integer;
  ALTER TABLE "transfer_routes" ADD COLUMN "to_airport_id" integer;
  ALTER TABLE "itinerary_patterns_rels" ADD COLUMN "service_items_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "airports_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "service_items_id" integer;
  ALTER TABLE "properties_accumulated_data_seasonality_data" ADD CONSTRAINT "properties_accumulated_data_seasonality_data_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_properties_v_version_accumulated_data_seasonality_data" ADD CONSTRAINT "_properties_v_version_accumulated_data_seasonality_data_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_properties_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "airports" ADD CONSTRAINT "airports_country_id_destinations_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "airports" ADD CONSTRAINT "airports_nearest_destination_id_destinations_id_fk" FOREIGN KEY ("nearest_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "airports_rels" ADD CONSTRAINT "airports_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."airports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "airports_rels" ADD CONSTRAINT "airports_rels_airports_fk" FOREIGN KEY ("airports_id") REFERENCES "public"."airports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "service_items" ADD CONSTRAINT "service_items_associated_airport_id_airports_id_fk" FOREIGN KEY ("associated_airport_id") REFERENCES "public"."airports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_items" ADD CONSTRAINT "service_items_associated_destination_id_destinations_id_fk" FOREIGN KEY ("associated_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_items_rels" ADD CONSTRAINT "service_items_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "service_items_rels" ADD CONSTRAINT "service_items_rels_itineraries_fk" FOREIGN KEY ("itineraries_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "location_mappings_mappings" ADD CONSTRAINT "location_mappings_mappings_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "location_mappings_mappings" ADD CONSTRAINT "location_mappings_mappings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "location_mappings_mappings" ADD CONSTRAINT "location_mappings_mappings_airport_id_airports_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "location_mappings_mappings" ADD CONSTRAINT "location_mappings_mappings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."location_mappings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "properties_accumulated_data_seasonality_data_order_idx" ON "properties_accumulated_data_seasonality_data" USING btree ("_order");
  CREATE INDEX "properties_accumulated_data_seasonality_data_parent_id_idx" ON "properties_accumulated_data_seasonality_data" USING btree ("_parent_id");
  CREATE INDEX "_properties_v_version_accumulated_data_seasonality_data_order_idx" ON "_properties_v_version_accumulated_data_seasonality_data" USING btree ("_order");
  CREATE INDEX "_properties_v_version_accumulated_data_seasonality_data_parent_id_idx" ON "_properties_v_version_accumulated_data_seasonality_data" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "airports_slug_idx" ON "airports" USING btree ("slug");
  CREATE INDEX "airports_iata_code_idx" ON "airports" USING btree ("iata_code");
  CREATE INDEX "airports_country_idx" ON "airports" USING btree ("country_id");
  CREATE INDEX "airports_nearest_destination_idx" ON "airports" USING btree ("nearest_destination_id");
  CREATE INDEX "airports_updated_at_idx" ON "airports" USING btree ("updated_at");
  CREATE INDEX "airports_created_at_idx" ON "airports" USING btree ("created_at");
  CREATE INDEX "airports_rels_order_idx" ON "airports_rels" USING btree ("order");
  CREATE INDEX "airports_rels_parent_idx" ON "airports_rels" USING btree ("parent_id");
  CREATE INDEX "airports_rels_path_idx" ON "airports_rels" USING btree ("path");
  CREATE INDEX "airports_rels_airports_id_idx" ON "airports_rels" USING btree ("airports_id");
  CREATE UNIQUE INDEX "service_items_slug_idx" ON "service_items" USING btree ("slug");
  CREATE INDEX "service_items_associated_airport_idx" ON "service_items" USING btree ("associated_airport_id");
  CREATE INDEX "service_items_associated_destination_idx" ON "service_items" USING btree ("associated_destination_id");
  CREATE INDEX "service_items_updated_at_idx" ON "service_items" USING btree ("updated_at");
  CREATE INDEX "service_items_created_at_idx" ON "service_items" USING btree ("created_at");
  CREATE INDEX "service_items_rels_order_idx" ON "service_items_rels" USING btree ("order");
  CREATE INDEX "service_items_rels_parent_idx" ON "service_items_rels" USING btree ("parent_id");
  CREATE INDEX "service_items_rels_path_idx" ON "service_items_rels" USING btree ("path");
  CREATE INDEX "service_items_rels_itineraries_id_idx" ON "service_items_rels" USING btree ("itineraries_id");
  CREATE INDEX "location_mappings_mappings_order_idx" ON "location_mappings_mappings" USING btree ("_order");
  CREATE INDEX "location_mappings_mappings_parent_id_idx" ON "location_mappings_mappings" USING btree ("_parent_id");
  CREATE INDEX "location_mappings_mappings_destination_idx" ON "location_mappings_mappings" USING btree ("destination_id");
  CREATE INDEX "location_mappings_mappings_property_idx" ON "location_mappings_mappings" USING btree ("property_id");
  CREATE INDEX "location_mappings_mappings_airport_idx" ON "location_mappings_mappings" USING btree ("airport_id");
  ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_from_airport_id_airports_id_fk" FOREIGN KEY ("from_airport_id") REFERENCES "public"."airports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_to_airport_id_airports_id_fk" FOREIGN KEY ("to_airport_id") REFERENCES "public"."airports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "itinerary_patterns_rels" ADD CONSTRAINT "itinerary_patterns_rels_service_items_fk" FOREIGN KEY ("service_items_id") REFERENCES "public"."service_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_airports_fk" FOREIGN KEY ("airports_id") REFERENCES "public"."airports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_service_items_fk" FOREIGN KEY ("service_items_id") REFERENCES "public"."service_items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "transfer_routes_from_airport_idx" ON "transfer_routes" USING btree ("from_airport_id");
  CREATE INDEX "transfer_routes_to_airport_idx" ON "transfer_routes" USING btree ("to_airport_id");
  CREATE INDEX "itinerary_patterns_rels_service_items_id_idx" ON "itinerary_patterns_rels" USING btree ("service_items_id");
  CREATE INDEX "payload_locked_documents_rels_airports_id_idx" ON "payload_locked_documents_rels" USING btree ("airports_id");
  CREATE INDEX "payload_locked_documents_rels_service_items_id_idx" ON "payload_locked_documents_rels" USING btree ("service_items_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "destination_name_mappings_mappings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"canonical" varchar NOT NULL,
  	"aliases" jsonb,
  	"destination_id" integer NOT NULL
  );
  
  CREATE TABLE "destination_name_mappings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "properties_accumulated_data_seasonality_data" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_properties_v_version_accumulated_data_seasonality_data" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "airports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "airports_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "service_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "service_items_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "location_mappings_mappings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "location_mappings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "properties_accumulated_data_seasonality_data" CASCADE;
  DROP TABLE "_properties_v_version_accumulated_data_seasonality_data" CASCADE;
  DROP TABLE "airports" CASCADE;
  DROP TABLE "airports_rels" CASCADE;
  DROP TABLE "service_items" CASCADE;
  DROP TABLE "service_items_rels" CASCADE;
  DROP TABLE "location_mappings_mappings" CASCADE;
  DROP TABLE "location_mappings" CASCADE;
  ALTER TABLE "transfer_routes" DROP CONSTRAINT "transfer_routes_from_airport_id_airports_id_fk";
  
  ALTER TABLE "transfer_routes" DROP CONSTRAINT "transfer_routes_to_airport_id_airports_id_fk";
  
  ALTER TABLE "itinerary_patterns_rels" DROP CONSTRAINT "itinerary_patterns_rels_service_items_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_airports_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_service_items_fk";
  
  DROP INDEX "transfer_routes_from_airport_idx";
  DROP INDEX "transfer_routes_to_airport_idx";
  DROP INDEX "itinerary_patterns_rels_service_items_id_idx";
  DROP INDEX "payload_locked_documents_rels_airports_id_idx";
  DROP INDEX "payload_locked_documents_rels_service_items_id_idx";
  ALTER TABLE "destination_name_mappings_mappings" ADD CONSTRAINT "destination_name_mappings_mappings_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "destination_name_mappings_mappings" ADD CONSTRAINT "destination_name_mappings_mappings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."destination_name_mappings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "destination_name_mappings_mappings_order_idx" ON "destination_name_mappings_mappings" USING btree ("_order");
  CREATE INDEX "destination_name_mappings_mappings_parent_id_idx" ON "destination_name_mappings_mappings" USING btree ("_parent_id");
  CREATE INDEX "destination_name_mappings_mappings_destination_idx" ON "destination_name_mappings_mappings" USING btree ("destination_id");
  ALTER TABLE "activities" DROP COLUMN "booking_behaviour_requires_advance_booking";
  ALTER TABLE "activities" DROP COLUMN "booking_behaviour_availability";
  ALTER TABLE "activities" DROP COLUMN "booking_behaviour_minimum_lead_days";
  ALTER TABLE "activities" DROP COLUMN "booking_behaviour_maximum_group_size";
  ALTER TABLE "activities" DROP COLUMN "booking_behaviour_is_included_in_tariff";
  ALTER TABLE "activities" DROP COLUMN "booking_behaviour_typical_additional_cost";
  ALTER TABLE "transfer_routes" DROP COLUMN "from_airport_id";
  ALTER TABLE "transfer_routes" DROP COLUMN "to_airport_id";
  ALTER TABLE "itinerary_patterns_rels" DROP COLUMN "service_items_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "airports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "service_items_id";
  DROP TYPE "public"."enum_activities_booking_behaviour_availability";
  DROP TYPE "public"."enum_airports_type";
  DROP TYPE "public"."enum_service_items_category";
  DROP TYPE "public"."enum_service_items_service_direction";
  DROP TYPE "public"."enum_service_items_service_level";
  DROP TYPE "public"."enum_location_mappings_mappings_source_system";
  DROP TYPE "public"."enum_location_mappings_mappings_resolved_as";`)
}
