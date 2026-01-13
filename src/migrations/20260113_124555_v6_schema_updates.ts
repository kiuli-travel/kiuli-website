import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_processing_status" AS ENUM('pending', 'processing', 'complete', 'failed');
  CREATE TYPE "public"."enum_media_labeling_status" AS ENUM('pending', 'processing', 'complete', 'failed', 'skipped');
  CREATE TYPE "public"."enum_itineraries_publish_blockers_severity" AS ENUM('error', 'warning');
  CREATE TYPE "public"."enum__itineraries_v_version_publish_blockers_severity" AS ENUM('error', 'warning');
  CREATE TYPE "public"."enum_itinerary_jobs_image_statuses_status" AS ENUM('pending', 'processing', 'complete', 'failed', 'skipped');
  CREATE TYPE "public"."enum_notifications_type" AS ENUM('success', 'error', 'warning', 'info');
  CREATE TABLE "media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"itineraries_id" integer
  );
  
  CREATE TABLE "itineraries_publish_blockers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"reason" varchar,
  	"severity" "enum_itineraries_publish_blockers_severity" DEFAULT 'error'
  );
  
  CREATE TABLE "itineraries_previous_versions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"version_number" numeric,
  	"scraped_at" timestamp(3) with time zone,
  	"data" jsonb
  );
  
  CREATE TABLE "_itineraries_v_version_publish_blockers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"reason" varchar,
  	"severity" "enum__itineraries_v_version_publish_blockers_severity" DEFAULT 'error',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_itineraries_v_version_previous_versions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_number" numeric,
  	"scraped_at" timestamp(3) with time zone,
  	"data" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "itinerary_jobs_image_statuses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source_s3_key" varchar NOT NULL,
  	"media_id" varchar,
  	"status" "enum_itinerary_jobs_image_statuses_status" DEFAULT 'pending',
  	"error" varchar,
  	"started_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_notifications_type" DEFAULT 'info' NOT NULL,
  	"message" varchar NOT NULL,
  	"job_id" integer,
  	"itinerary_id" integer,
  	"read" boolean DEFAULT false,
  	"read_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "media" ADD COLUMN "source_s3_key" varchar;
  ALTER TABLE "media" ADD COLUMN "processing_status" "enum_media_processing_status" DEFAULT 'pending';
  ALTER TABLE "media" ADD COLUMN "processing_error" varchar;
  ALTER TABLE "media" ADD COLUMN "labeling_status" "enum_media_labeling_status" DEFAULT 'pending';
  ALTER TABLE "itineraries_blocks_stay" ADD COLUMN "description_original" jsonb;
  ALTER TABLE "itineraries_blocks_stay" ADD COLUMN "description_enhanced" jsonb;
  ALTER TABLE "itineraries_blocks_activity" ADD COLUMN "description_original" jsonb;
  ALTER TABLE "itineraries_blocks_activity" ADD COLUMN "description_enhanced" jsonb;
  ALTER TABLE "itineraries_blocks_transfer" ADD COLUMN "description_original" jsonb;
  ALTER TABLE "itineraries_blocks_transfer" ADD COLUMN "description_enhanced" jsonb;
  ALTER TABLE "itineraries_faq_items" ADD COLUMN "answer_original" jsonb;
  ALTER TABLE "itineraries_faq_items" ADD COLUMN "answer_enhanced" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "hero_image_locked" boolean DEFAULT false;
  ALTER TABLE "itineraries" ADD COLUMN "overview_summary_original" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "overview_summary_enhanced" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "why_kiuli_original" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "why_kiuli_enhanced" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "publish_checklist_all_images_processed" boolean DEFAULT false;
  ALTER TABLE "itineraries" ADD COLUMN "publish_checklist_no_failed_images" boolean DEFAULT false;
  ALTER TABLE "itineraries" ADD COLUMN "publish_checklist_hero_image_selected" boolean DEFAULT false;
  ALTER TABLE "itineraries" ADD COLUMN "publish_checklist_content_enhanced" boolean DEFAULT false;
  ALTER TABLE "itineraries" ADD COLUMN "publish_checklist_schema_generated" boolean DEFAULT false;
  ALTER TABLE "itineraries" ADD COLUMN "publish_checklist_meta_fields_filled" boolean DEFAULT false;
  ALTER TABLE "itineraries" ADD COLUMN "version" numeric DEFAULT 1;
  ALTER TABLE "_itineraries_v_blocks_stay" ADD COLUMN "description_original" jsonb;
  ALTER TABLE "_itineraries_v_blocks_stay" ADD COLUMN "description_enhanced" jsonb;
  ALTER TABLE "_itineraries_v_blocks_activity" ADD COLUMN "description_original" jsonb;
  ALTER TABLE "_itineraries_v_blocks_activity" ADD COLUMN "description_enhanced" jsonb;
  ALTER TABLE "_itineraries_v_blocks_transfer" ADD COLUMN "description_original" jsonb;
  ALTER TABLE "_itineraries_v_blocks_transfer" ADD COLUMN "description_enhanced" jsonb;
  ALTER TABLE "_itineraries_v_version_faq_items" ADD COLUMN "answer_original" jsonb;
  ALTER TABLE "_itineraries_v_version_faq_items" ADD COLUMN "answer_enhanced" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_hero_image_locked" boolean DEFAULT false;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_overview_summary_original" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_overview_summary_enhanced" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_why_kiuli_original" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_why_kiuli_enhanced" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_publish_checklist_all_images_processed" boolean DEFAULT false;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_publish_checklist_no_failed_images" boolean DEFAULT false;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_publish_checklist_hero_image_selected" boolean DEFAULT false;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_publish_checklist_content_enhanced" boolean DEFAULT false;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_publish_checklist_schema_generated" boolean DEFAULT false;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_publish_checklist_meta_fields_filled" boolean DEFAULT false;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_version" numeric DEFAULT 1;
  ALTER TABLE "itinerary_jobs" ADD COLUMN "images_labeled" numeric DEFAULT 0;
  ALTER TABLE "itinerary_jobs" ADD COLUMN "images_to_label" numeric;
  ALTER TABLE "itinerary_jobs" ADD COLUMN "labeling_started_at" timestamp(3) with time zone;
  ALTER TABLE "itinerary_jobs" ADD COLUMN "labeling_completed_at" timestamp(3) with time zone;
  ALTER TABLE "itinerary_jobs" ADD COLUMN "estimated_time_remaining" numeric;
  ALTER TABLE "itinerary_jobs" ADD COLUMN "phase1_completed_at" timestamp(3) with time zone;
  ALTER TABLE "itinerary_jobs" ADD COLUMN "phase2_completed_at" timestamp(3) with time zone;
  ALTER TABLE "itinerary_jobs" ADD COLUMN "phase3_completed_at" timestamp(3) with time zone;
  ALTER TABLE "itinerary_jobs" ADD COLUMN "phase4_completed_at" timestamp(3) with time zone;
  ALTER TABLE "itinerary_jobs" ADD COLUMN "phase5_completed_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notifications_id" integer;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_itineraries_fk" FOREIGN KEY ("itineraries_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itineraries_publish_blockers" ADD CONSTRAINT "itineraries_publish_blockers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itineraries_previous_versions" ADD CONSTRAINT "itineraries_previous_versions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_itineraries_v_version_publish_blockers" ADD CONSTRAINT "_itineraries_v_version_publish_blockers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_itineraries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_itineraries_v_version_previous_versions" ADD CONSTRAINT "_itineraries_v_version_previous_versions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_itineraries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "itinerary_jobs_image_statuses" ADD CONSTRAINT "itinerary_jobs_image_statuses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."itinerary_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_job_id_itinerary_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."itinerary_jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_itinerary_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "media_rels_order_idx" ON "media_rels" USING btree ("order");
  CREATE INDEX "media_rels_parent_idx" ON "media_rels" USING btree ("parent_id");
  CREATE INDEX "media_rels_path_idx" ON "media_rels" USING btree ("path");
  CREATE INDEX "media_rels_itineraries_id_idx" ON "media_rels" USING btree ("itineraries_id");
  CREATE INDEX "itineraries_publish_blockers_order_idx" ON "itineraries_publish_blockers" USING btree ("_order");
  CREATE INDEX "itineraries_publish_blockers_parent_id_idx" ON "itineraries_publish_blockers" USING btree ("_parent_id");
  CREATE INDEX "itineraries_previous_versions_order_idx" ON "itineraries_previous_versions" USING btree ("_order");
  CREATE INDEX "itineraries_previous_versions_parent_id_idx" ON "itineraries_previous_versions" USING btree ("_parent_id");
  CREATE INDEX "_itineraries_v_version_publish_blockers_order_idx" ON "_itineraries_v_version_publish_blockers" USING btree ("_order");
  CREATE INDEX "_itineraries_v_version_publish_blockers_parent_id_idx" ON "_itineraries_v_version_publish_blockers" USING btree ("_parent_id");
  CREATE INDEX "_itineraries_v_version_previous_versions_order_idx" ON "_itineraries_v_version_previous_versions" USING btree ("_order");
  CREATE INDEX "_itineraries_v_version_previous_versions_parent_id_idx" ON "_itineraries_v_version_previous_versions" USING btree ("_parent_id");
  CREATE INDEX "itinerary_jobs_image_statuses_order_idx" ON "itinerary_jobs_image_statuses" USING btree ("_order");
  CREATE INDEX "itinerary_jobs_image_statuses_parent_id_idx" ON "itinerary_jobs_image_statuses" USING btree ("_parent_id");
  CREATE INDEX "notifications_job_idx" ON "notifications" USING btree ("job_id");
  CREATE INDEX "notifications_itinerary_idx" ON "notifications" USING btree ("itinerary_id");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "media_source_s3_key_idx" ON "media" USING btree ("source_s3_key");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  ALTER TABLE "itineraries_blocks_stay" DROP COLUMN "description";
  ALTER TABLE "itineraries_blocks_activity" DROP COLUMN "description";
  ALTER TABLE "itineraries_blocks_transfer" DROP COLUMN "description";
  ALTER TABLE "itineraries_faq_items" DROP COLUMN "answer";
  ALTER TABLE "itineraries" DROP COLUMN "overview_summary";
  ALTER TABLE "itineraries" DROP COLUMN "why_kiuli";
  ALTER TABLE "_itineraries_v_blocks_stay" DROP COLUMN "description";
  ALTER TABLE "_itineraries_v_blocks_activity" DROP COLUMN "description";
  ALTER TABLE "_itineraries_v_blocks_transfer" DROP COLUMN "description";
  ALTER TABLE "_itineraries_v_version_faq_items" DROP COLUMN "answer";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_overview_summary";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_why_kiuli";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itineraries_publish_blockers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itineraries_previous_versions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_itineraries_v_version_publish_blockers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_itineraries_v_version_previous_versions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "itinerary_jobs_image_statuses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "media_rels" CASCADE;
  DROP TABLE "itineraries_publish_blockers" CASCADE;
  DROP TABLE "itineraries_previous_versions" CASCADE;
  DROP TABLE "_itineraries_v_version_publish_blockers" CASCADE;
  DROP TABLE "_itineraries_v_version_previous_versions" CASCADE;
  DROP TABLE "itinerary_jobs_image_statuses" CASCADE;
  DROP TABLE "notifications" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notifications_fk";
  
  DROP INDEX "media_source_s3_key_idx";
  DROP INDEX "payload_locked_documents_rels_notifications_id_idx";
  ALTER TABLE "itineraries_blocks_stay" ADD COLUMN "description" jsonb;
  ALTER TABLE "itineraries_blocks_activity" ADD COLUMN "description" jsonb;
  ALTER TABLE "itineraries_blocks_transfer" ADD COLUMN "description" jsonb;
  ALTER TABLE "itineraries_faq_items" ADD COLUMN "answer" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "overview_summary" jsonb;
  ALTER TABLE "itineraries" ADD COLUMN "why_kiuli" jsonb;
  ALTER TABLE "_itineraries_v_blocks_stay" ADD COLUMN "description" jsonb;
  ALTER TABLE "_itineraries_v_blocks_activity" ADD COLUMN "description" jsonb;
  ALTER TABLE "_itineraries_v_blocks_transfer" ADD COLUMN "description" jsonb;
  ALTER TABLE "_itineraries_v_version_faq_items" ADD COLUMN "answer" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_overview_summary" jsonb;
  ALTER TABLE "_itineraries_v" ADD COLUMN "version_why_kiuli" jsonb;
  ALTER TABLE "media" DROP COLUMN "source_s3_key";
  ALTER TABLE "media" DROP COLUMN "processing_status";
  ALTER TABLE "media" DROP COLUMN "processing_error";
  ALTER TABLE "media" DROP COLUMN "labeling_status";
  ALTER TABLE "itineraries_blocks_stay" DROP COLUMN "description_original";
  ALTER TABLE "itineraries_blocks_stay" DROP COLUMN "description_enhanced";
  ALTER TABLE "itineraries_blocks_activity" DROP COLUMN "description_original";
  ALTER TABLE "itineraries_blocks_activity" DROP COLUMN "description_enhanced";
  ALTER TABLE "itineraries_blocks_transfer" DROP COLUMN "description_original";
  ALTER TABLE "itineraries_blocks_transfer" DROP COLUMN "description_enhanced";
  ALTER TABLE "itineraries_faq_items" DROP COLUMN "answer_original";
  ALTER TABLE "itineraries_faq_items" DROP COLUMN "answer_enhanced";
  ALTER TABLE "itineraries" DROP COLUMN "hero_image_locked";
  ALTER TABLE "itineraries" DROP COLUMN "overview_summary_original";
  ALTER TABLE "itineraries" DROP COLUMN "overview_summary_enhanced";
  ALTER TABLE "itineraries" DROP COLUMN "why_kiuli_original";
  ALTER TABLE "itineraries" DROP COLUMN "why_kiuli_enhanced";
  ALTER TABLE "itineraries" DROP COLUMN "publish_checklist_all_images_processed";
  ALTER TABLE "itineraries" DROP COLUMN "publish_checklist_no_failed_images";
  ALTER TABLE "itineraries" DROP COLUMN "publish_checklist_hero_image_selected";
  ALTER TABLE "itineraries" DROP COLUMN "publish_checklist_content_enhanced";
  ALTER TABLE "itineraries" DROP COLUMN "publish_checklist_schema_generated";
  ALTER TABLE "itineraries" DROP COLUMN "publish_checklist_meta_fields_filled";
  ALTER TABLE "itineraries" DROP COLUMN "version";
  ALTER TABLE "_itineraries_v_blocks_stay" DROP COLUMN "description_original";
  ALTER TABLE "_itineraries_v_blocks_stay" DROP COLUMN "description_enhanced";
  ALTER TABLE "_itineraries_v_blocks_activity" DROP COLUMN "description_original";
  ALTER TABLE "_itineraries_v_blocks_activity" DROP COLUMN "description_enhanced";
  ALTER TABLE "_itineraries_v_blocks_transfer" DROP COLUMN "description_original";
  ALTER TABLE "_itineraries_v_blocks_transfer" DROP COLUMN "description_enhanced";
  ALTER TABLE "_itineraries_v_version_faq_items" DROP COLUMN "answer_original";
  ALTER TABLE "_itineraries_v_version_faq_items" DROP COLUMN "answer_enhanced";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_hero_image_locked";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_overview_summary_original";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_overview_summary_enhanced";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_why_kiuli_original";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_why_kiuli_enhanced";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_publish_checklist_all_images_processed";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_publish_checklist_no_failed_images";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_publish_checklist_hero_image_selected";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_publish_checklist_content_enhanced";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_publish_checklist_schema_generated";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_publish_checklist_meta_fields_filled";
  ALTER TABLE "_itineraries_v" DROP COLUMN "version_version";
  ALTER TABLE "itinerary_jobs" DROP COLUMN "images_labeled";
  ALTER TABLE "itinerary_jobs" DROP COLUMN "images_to_label";
  ALTER TABLE "itinerary_jobs" DROP COLUMN "labeling_started_at";
  ALTER TABLE "itinerary_jobs" DROP COLUMN "labeling_completed_at";
  ALTER TABLE "itinerary_jobs" DROP COLUMN "estimated_time_remaining";
  ALTER TABLE "itinerary_jobs" DROP COLUMN "phase1_completed_at";
  ALTER TABLE "itinerary_jobs" DROP COLUMN "phase2_completed_at";
  ALTER TABLE "itinerary_jobs" DROP COLUMN "phase3_completed_at";
  ALTER TABLE "itinerary_jobs" DROP COLUMN "phase4_completed_at";
  ALTER TABLE "itinerary_jobs" DROP COLUMN "phase5_completed_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notifications_id";
  DROP TYPE "public"."enum_media_processing_status";
  DROP TYPE "public"."enum_media_labeling_status";
  DROP TYPE "public"."enum_itineraries_publish_blockers_severity";
  DROP TYPE "public"."enum__itineraries_v_version_publish_blockers_severity";
  DROP TYPE "public"."enum_itinerary_jobs_image_statuses_status";
  DROP TYPE "public"."enum_notifications_type";`)
}
