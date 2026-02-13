import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_content_projects_target_audience" AS ENUM('customer', 'professional', 'guide');
  CREATE TYPE "public"."enum_content_projects_sources_credibility" AS ENUM('authoritative', 'peer_reviewed', 'preprint', 'trade', 'other');
  CREATE TYPE "public"."enum_content_projects_proprietary_angles_source" AS ENUM('designer', 'client', 'booking', 'supplier');
  CREATE TYPE "public"."enum_content_projects_uncertainty_map_confidence" AS ENUM('fact', 'inference', 'uncertain');
  CREATE TYPE "public"."enum_content_projects_generated_candidates_status" AS ENUM('candidate', 'selected', 'rejected');
  CREATE TYPE "public"."enum_content_projects_consistency_issues_issue_type" AS ENUM('hard', 'soft', 'staleness');
  CREATE TYPE "public"."enum_content_projects_consistency_issues_resolution" AS ENUM('pending', 'updated_draft', 'updated_existing', 'overridden');
  CREATE TYPE "public"."enum_content_projects_messages_role" AS ENUM('designer', 'kiuli');
  CREATE TYPE "public"."enum_content_projects_stage" AS ENUM('idea', 'brief', 'research', 'draft', 'review', 'published', 'proposed', 'rejected', 'filtered');
  CREATE TYPE "public"."enum_content_projects_content_type" AS ENUM('itinerary_cluster', 'authority', 'designer_insight', 'destination_page', 'property_page', 'itinerary_enhancement', 'page_update');
  CREATE TYPE "public"."enum_content_projects_origin_pathway" AS ENUM('itinerary', 'external', 'designer', 'cascade');
  CREATE TYPE "public"."enum_content_projects_processing_status" AS ENUM('idle', 'processing', 'completed', 'failed');
  CREATE TYPE "public"."enum_content_projects_target_collection" AS ENUM('destinations', 'itineraries', 'posts', 'properties');
  CREATE TYPE "public"."enum_content_projects_consistency_check_result" AS ENUM('pass', 'hard_contradiction', 'soft_contradiction', 'not_checked');
  CREATE TYPE "public"."enum_content_projects_freshness_category" AS ENUM('monthly', 'quarterly', 'annual', 'evergreen');
  CREATE TYPE "public"."enum_content_projects_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__content_projects_v_version_target_audience" AS ENUM('customer', 'professional', 'guide');
  CREATE TYPE "public"."enum__content_projects_v_version_sources_credibility" AS ENUM('authoritative', 'peer_reviewed', 'preprint', 'trade', 'other');
  CREATE TYPE "public"."enum__content_projects_v_version_proprietary_angles_source" AS ENUM('designer', 'client', 'booking', 'supplier');
  CREATE TYPE "public"."enum__content_projects_v_version_uncertainty_map_confidence" AS ENUM('fact', 'inference', 'uncertain');
  CREATE TYPE "public"."enum__content_projects_v_version_generated_candidates_status" AS ENUM('candidate', 'selected', 'rejected');
  CREATE TYPE "public"."enum__content_projects_v_version_consistency_issues_issue_type" AS ENUM('hard', 'soft', 'staleness');
  CREATE TYPE "public"."enum__content_projects_v_version_consistency_issues_resolution" AS ENUM('pending', 'updated_draft', 'updated_existing', 'overridden');
  CREATE TYPE "public"."enum__content_projects_v_version_messages_role" AS ENUM('designer', 'kiuli');
  CREATE TYPE "public"."enum__content_projects_v_version_stage" AS ENUM('idea', 'brief', 'research', 'draft', 'review', 'published', 'proposed', 'rejected', 'filtered');
  CREATE TYPE "public"."enum__content_projects_v_version_content_type" AS ENUM('itinerary_cluster', 'authority', 'designer_insight', 'destination_page', 'property_page', 'itinerary_enhancement', 'page_update');
  CREATE TYPE "public"."enum__content_projects_v_version_origin_pathway" AS ENUM('itinerary', 'external', 'designer', 'cascade');
  CREATE TYPE "public"."enum__content_projects_v_version_processing_status" AS ENUM('idle', 'processing', 'completed', 'failed');
  CREATE TYPE "public"."enum__content_projects_v_version_target_collection" AS ENUM('destinations', 'itineraries', 'posts', 'properties');
  CREATE TYPE "public"."enum__content_projects_v_version_consistency_check_result" AS ENUM('pass', 'hard_contradiction', 'soft_contradiction', 'not_checked');
  CREATE TYPE "public"."enum__content_projects_v_version_freshness_category" AS ENUM('monthly', 'quarterly', 'annual', 'evergreen');
  CREATE TYPE "public"."enum__content_projects_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_content_jobs_job_type" AS ENUM('cascade', 'decompose', 'source_monitor', 'batch_embed', 'bootstrap');
  CREATE TYPE "public"."enum_content_jobs_status" AS ENUM('pending', 'running', 'completed', 'failed');
  CREATE TYPE "public"."enum_content_jobs_created_by" AS ENUM('hook', 'manual', 'schedule');
  CREATE TYPE "public"."enum_source_registry_category" AS ENUM('science', 'conservation', 'industry', 'policy');
  CREATE TYPE "public"."enum_source_registry_check_method" AS ENUM('rss', 'api');
  CREATE TABLE "content_projects_target_audience" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_content_projects_target_audience",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "content_projects_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"url" varchar,
  	"credibility" "enum_content_projects_sources_credibility",
  	"notes" varchar
  );
  
  CREATE TABLE "content_projects_proprietary_angles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"angle" varchar,
  	"source" "enum_content_projects_proprietary_angles_source"
  );
  
  CREATE TABLE "content_projects_uncertainty_map" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"claim" varchar,
  	"confidence" "enum_content_projects_uncertainty_map_confidence",
  	"notes" varchar
  );
  
  CREATE TABLE "content_projects_faq_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "content_projects_generated_candidates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_url" varchar,
  	"prompt" varchar,
  	"status" "enum_content_projects_generated_candidates_status" DEFAULT 'candidate'
  );
  
  CREATE TABLE "content_projects_consistency_issues" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"issue_type" "enum_content_projects_consistency_issues_issue_type",
  	"existing_content" varchar,
  	"new_content" varchar,
  	"source_record" varchar,
  	"resolution" "enum_content_projects_consistency_issues_resolution" DEFAULT 'pending',
  	"resolution_note" varchar
  );
  
  CREATE TABLE "content_projects_messages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"role" "enum_content_projects_messages_role",
  	"content" varchar,
  	"timestamp" timestamp(3) with time zone,
  	"actions" jsonb
  );
  
  CREATE TABLE "content_projects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"stage" "enum_content_projects_stage" DEFAULT 'idea',
  	"content_type" "enum_content_projects_content_type",
  	"origin_pathway" "enum_content_projects_origin_pathway",
  	"origin_itinerary_id" integer,
  	"origin_source_id" integer,
  	"origin_url" varchar,
  	"filter_reason" varchar,
  	"processing_status" "enum_content_projects_processing_status" DEFAULT 'idle',
  	"processing_error" varchar,
  	"processing_started_at" timestamp(3) with time zone,
  	"target_collection" "enum_content_projects_target_collection",
  	"target_record_id" varchar,
  	"target_field" varchar,
  	"target_current_content" jsonb,
  	"target_updated_at" timestamp(3) with time zone,
  	"brief_summary" varchar,
  	"target_angle" varchar,
  	"competitive_notes" varchar,
  	"synthesis" jsonb,
  	"existing_site_content" jsonb,
  	"editorial_notes" jsonb,
  	"body" jsonb,
  	"sections" jsonb,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"answer_capsule" varchar,
  	"hero_image_id" integer,
  	"library_matches" jsonb,
  	"linkedin_summary" varchar,
  	"facebook_summary" varchar,
  	"facebook_pinned_comment" varchar,
  	"posted_to_linkedin" boolean DEFAULT false,
  	"posted_to_facebook" boolean DEFAULT false,
  	"linkedin_post_id" varchar,
  	"facebook_post_id" varchar,
  	"consistency_check_result" "enum_content_projects_consistency_check_result" DEFAULT 'not_checked',
  	"destinations" jsonb,
  	"properties" jsonb,
  	"species" jsonb,
  	"freshness_category" "enum_content_projects_freshness_category",
  	"published_at" timestamp(3) with time zone,
  	"last_reviewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_content_projects_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "content_projects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"content_projects_id" integer,
  	"itineraries_id" integer,
  	"destinations_id" integer,
  	"properties_id" integer
  );
  
  CREATE TABLE "_content_projects_v_version_target_audience" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__content_projects_v_version_target_audience",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_content_projects_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"url" varchar,
  	"credibility" "enum__content_projects_v_version_sources_credibility",
  	"notes" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_content_projects_v_version_proprietary_angles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"angle" varchar,
  	"source" "enum__content_projects_v_version_proprietary_angles_source",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_content_projects_v_version_uncertainty_map" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"claim" varchar,
  	"confidence" "enum__content_projects_v_version_uncertainty_map_confidence",
  	"notes" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_content_projects_v_version_faq_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_content_projects_v_version_generated_candidates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_url" varchar,
  	"prompt" varchar,
  	"status" "enum__content_projects_v_version_generated_candidates_status" DEFAULT 'candidate',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_content_projects_v_version_consistency_issues" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"issue_type" "enum__content_projects_v_version_consistency_issues_issue_type",
  	"existing_content" varchar,
  	"new_content" varchar,
  	"source_record" varchar,
  	"resolution" "enum__content_projects_v_version_consistency_issues_resolution" DEFAULT 'pending',
  	"resolution_note" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_content_projects_v_version_messages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum__content_projects_v_version_messages_role",
  	"content" varchar,
  	"timestamp" timestamp(3) with time zone,
  	"actions" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_content_projects_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_stage" "enum__content_projects_v_version_stage" DEFAULT 'idea',
  	"version_content_type" "enum__content_projects_v_version_content_type",
  	"version_origin_pathway" "enum__content_projects_v_version_origin_pathway",
  	"version_origin_itinerary_id" integer,
  	"version_origin_source_id" integer,
  	"version_origin_url" varchar,
  	"version_filter_reason" varchar,
  	"version_processing_status" "enum__content_projects_v_version_processing_status" DEFAULT 'idle',
  	"version_processing_error" varchar,
  	"version_processing_started_at" timestamp(3) with time zone,
  	"version_target_collection" "enum__content_projects_v_version_target_collection",
  	"version_target_record_id" varchar,
  	"version_target_field" varchar,
  	"version_target_current_content" jsonb,
  	"version_target_updated_at" timestamp(3) with time zone,
  	"version_brief_summary" varchar,
  	"version_target_angle" varchar,
  	"version_competitive_notes" varchar,
  	"version_synthesis" jsonb,
  	"version_existing_site_content" jsonb,
  	"version_editorial_notes" jsonb,
  	"version_body" jsonb,
  	"version_sections" jsonb,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_answer_capsule" varchar,
  	"version_hero_image_id" integer,
  	"version_library_matches" jsonb,
  	"version_linkedin_summary" varchar,
  	"version_facebook_summary" varchar,
  	"version_facebook_pinned_comment" varchar,
  	"version_posted_to_linkedin" boolean DEFAULT false,
  	"version_posted_to_facebook" boolean DEFAULT false,
  	"version_linkedin_post_id" varchar,
  	"version_facebook_post_id" varchar,
  	"version_consistency_check_result" "enum__content_projects_v_version_consistency_check_result" DEFAULT 'not_checked',
  	"version_destinations" jsonb,
  	"version_properties" jsonb,
  	"version_species" jsonb,
  	"version_freshness_category" "enum__content_projects_v_version_freshness_category",
  	"version_published_at" timestamp(3) with time zone,
  	"version_last_reviewed_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__content_projects_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_content_projects_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"content_projects_id" integer,
  	"itineraries_id" integer,
  	"destinations_id" integer,
  	"properties_id" integer
  );
  
  CREATE TABLE "content_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"job_type" "enum_content_jobs_job_type" NOT NULL,
  	"status" "enum_content_jobs_status" DEFAULT 'pending' NOT NULL,
  	"itinerary_id_id" integer,
  	"progress" jsonb,
  	"error" varchar,
  	"started_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"retried_count" numeric DEFAULT 0,
  	"max_retries" numeric DEFAULT 2,
  	"created_by" "enum_content_jobs_created_by",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "source_registry" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"feed_url" varchar NOT NULL,
  	"category" "enum_source_registry_category",
  	"check_method" "enum_source_registry_check_method",
  	"active" boolean DEFAULT true,
  	"last_checked_at" timestamp(3) with time zone,
  	"last_processed_item_id" varchar,
  	"last_processed_item_timestamp" timestamp(3) with time zone,
  	"recent_processed_ids" jsonb,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "editorial_directives" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"topic_tags" jsonb,
  	"destination_tags" jsonb,
  	"content_type_tags" jsonb,
  	"active" boolean DEFAULT true,
  	"review_after" timestamp(3) with time zone,
  	"last_reviewed_at" timestamp(3) with time zone,
  	"filter_count30d" numeric DEFAULT 0,
  	"origin_project_id" integer,
  	"origin_rejection_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "content_system_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ideation_model" varchar DEFAULT 'anthropic/claude-sonnet-4-20250514',
  	"research_model" varchar DEFAULT 'anthropic/claude-sonnet-4-20250514',
  	"drafting_model" varchar DEFAULT 'anthropic/claude-sonnet-4-20250514',
  	"editing_model" varchar DEFAULT 'anthropic/claude-sonnet-4-20250514',
  	"image_model" varchar DEFAULT 'anthropic/claude-sonnet-4-20250514',
  	"embedding_model" varchar DEFAULT 'openai/text-embedding-3-large',
  	"default_image_prompt_prefix" varchar,
  	"consistency_check_enabled" boolean DEFAULT true,
  	"auto_populate_relationships" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
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
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "content_projects_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "content_jobs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "source_registry_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "editorial_directives_id" integer;
  ALTER TABLE "content_projects_target_audience" ADD CONSTRAINT "content_projects_target_audience_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_sources" ADD CONSTRAINT "content_projects_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_proprietary_angles" ADD CONSTRAINT "content_projects_proprietary_angles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_uncertainty_map" ADD CONSTRAINT "content_projects_uncertainty_map_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_faq_section" ADD CONSTRAINT "content_projects_faq_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_generated_candidates" ADD CONSTRAINT "content_projects_generated_candidates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_consistency_issues" ADD CONSTRAINT "content_projects_consistency_issues_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_messages" ADD CONSTRAINT "content_projects_messages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects" ADD CONSTRAINT "content_projects_origin_itinerary_id_itineraries_id_fk" FOREIGN KEY ("origin_itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_projects" ADD CONSTRAINT "content_projects_origin_source_id_source_registry_id_fk" FOREIGN KEY ("origin_source_id") REFERENCES "public"."source_registry"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_projects" ADD CONSTRAINT "content_projects_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_projects_rels" ADD CONSTRAINT "content_projects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_rels" ADD CONSTRAINT "content_projects_rels_content_projects_fk" FOREIGN KEY ("content_projects_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_rels" ADD CONSTRAINT "content_projects_rels_itineraries_fk" FOREIGN KEY ("itineraries_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_rels" ADD CONSTRAINT "content_projects_rels_destinations_fk" FOREIGN KEY ("destinations_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_projects_rels" ADD CONSTRAINT "content_projects_rels_properties_fk" FOREIGN KEY ("properties_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_version_target_audience" ADD CONSTRAINT "_content_projects_v_version_target_audience_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_content_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_version_sources" ADD CONSTRAINT "_content_projects_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_content_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_version_proprietary_angles" ADD CONSTRAINT "_content_projects_v_version_proprietary_angles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_content_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_version_uncertainty_map" ADD CONSTRAINT "_content_projects_v_version_uncertainty_map_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_content_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_version_faq_section" ADD CONSTRAINT "_content_projects_v_version_faq_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_content_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_version_generated_candidates" ADD CONSTRAINT "_content_projects_v_version_generated_candidates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_content_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_version_consistency_issues" ADD CONSTRAINT "_content_projects_v_version_consistency_issues_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_content_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_version_messages" ADD CONSTRAINT "_content_projects_v_version_messages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_content_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v" ADD CONSTRAINT "_content_projects_v_parent_id_content_projects_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_content_projects_v" ADD CONSTRAINT "_content_projects_v_version_origin_itinerary_id_itineraries_id_fk" FOREIGN KEY ("version_origin_itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_content_projects_v" ADD CONSTRAINT "_content_projects_v_version_origin_source_id_source_registry_id_fk" FOREIGN KEY ("version_origin_source_id") REFERENCES "public"."source_registry"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_content_projects_v" ADD CONSTRAINT "_content_projects_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_content_projects_v_rels" ADD CONSTRAINT "_content_projects_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_content_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_rels" ADD CONSTRAINT "_content_projects_v_rels_content_projects_fk" FOREIGN KEY ("content_projects_id") REFERENCES "public"."content_projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_rels" ADD CONSTRAINT "_content_projects_v_rels_itineraries_fk" FOREIGN KEY ("itineraries_id") REFERENCES "public"."itineraries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_rels" ADD CONSTRAINT "_content_projects_v_rels_destinations_fk" FOREIGN KEY ("destinations_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_projects_v_rels" ADD CONSTRAINT "_content_projects_v_rels_properties_fk" FOREIGN KEY ("properties_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_jobs" ADD CONSTRAINT "content_jobs_itinerary_id_id_itineraries_id_fk" FOREIGN KEY ("itinerary_id_id") REFERENCES "public"."itineraries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "editorial_directives" ADD CONSTRAINT "editorial_directives_origin_project_id_content_projects_id_fk" FOREIGN KEY ("origin_project_id") REFERENCES "public"."content_projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "destination_name_mappings_mappings" ADD CONSTRAINT "destination_name_mappings_mappings_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "destination_name_mappings_mappings" ADD CONSTRAINT "destination_name_mappings_mappings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."destination_name_mappings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "content_projects_target_audience_order_idx" ON "content_projects_target_audience" USING btree ("order");
  CREATE INDEX "content_projects_target_audience_parent_idx" ON "content_projects_target_audience" USING btree ("parent_id");
  CREATE INDEX "content_projects_sources_order_idx" ON "content_projects_sources" USING btree ("_order");
  CREATE INDEX "content_projects_sources_parent_id_idx" ON "content_projects_sources" USING btree ("_parent_id");
  CREATE INDEX "content_projects_proprietary_angles_order_idx" ON "content_projects_proprietary_angles" USING btree ("_order");
  CREATE INDEX "content_projects_proprietary_angles_parent_id_idx" ON "content_projects_proprietary_angles" USING btree ("_parent_id");
  CREATE INDEX "content_projects_uncertainty_map_order_idx" ON "content_projects_uncertainty_map" USING btree ("_order");
  CREATE INDEX "content_projects_uncertainty_map_parent_id_idx" ON "content_projects_uncertainty_map" USING btree ("_parent_id");
  CREATE INDEX "content_projects_faq_section_order_idx" ON "content_projects_faq_section" USING btree ("_order");
  CREATE INDEX "content_projects_faq_section_parent_id_idx" ON "content_projects_faq_section" USING btree ("_parent_id");
  CREATE INDEX "content_projects_generated_candidates_order_idx" ON "content_projects_generated_candidates" USING btree ("_order");
  CREATE INDEX "content_projects_generated_candidates_parent_id_idx" ON "content_projects_generated_candidates" USING btree ("_parent_id");
  CREATE INDEX "content_projects_consistency_issues_order_idx" ON "content_projects_consistency_issues" USING btree ("_order");
  CREATE INDEX "content_projects_consistency_issues_parent_id_idx" ON "content_projects_consistency_issues" USING btree ("_parent_id");
  CREATE INDEX "content_projects_messages_order_idx" ON "content_projects_messages" USING btree ("_order");
  CREATE INDEX "content_projects_messages_parent_id_idx" ON "content_projects_messages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "content_projects_slug_idx" ON "content_projects" USING btree ("slug");
  CREATE INDEX "content_projects_origin_itinerary_idx" ON "content_projects" USING btree ("origin_itinerary_id");
  CREATE INDEX "content_projects_origin_source_idx" ON "content_projects" USING btree ("origin_source_id");
  CREATE INDEX "content_projects_hero_image_idx" ON "content_projects" USING btree ("hero_image_id");
  CREATE INDEX "content_projects_updated_at_idx" ON "content_projects" USING btree ("updated_at");
  CREATE INDEX "content_projects_created_at_idx" ON "content_projects" USING btree ("created_at");
  CREATE INDEX "content_projects__status_idx" ON "content_projects" USING btree ("_status");
  CREATE INDEX "content_projects_rels_order_idx" ON "content_projects_rels" USING btree ("order");
  CREATE INDEX "content_projects_rels_parent_idx" ON "content_projects_rels" USING btree ("parent_id");
  CREATE INDEX "content_projects_rels_path_idx" ON "content_projects_rels" USING btree ("path");
  CREATE INDEX "content_projects_rels_content_projects_id_idx" ON "content_projects_rels" USING btree ("content_projects_id");
  CREATE INDEX "content_projects_rels_itineraries_id_idx" ON "content_projects_rels" USING btree ("itineraries_id");
  CREATE INDEX "content_projects_rels_destinations_id_idx" ON "content_projects_rels" USING btree ("destinations_id");
  CREATE INDEX "content_projects_rels_properties_id_idx" ON "content_projects_rels" USING btree ("properties_id");
  CREATE INDEX "_content_projects_v_version_target_audience_order_idx" ON "_content_projects_v_version_target_audience" USING btree ("order");
  CREATE INDEX "_content_projects_v_version_target_audience_parent_idx" ON "_content_projects_v_version_target_audience" USING btree ("parent_id");
  CREATE INDEX "_content_projects_v_version_sources_order_idx" ON "_content_projects_v_version_sources" USING btree ("_order");
  CREATE INDEX "_content_projects_v_version_sources_parent_id_idx" ON "_content_projects_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_content_projects_v_version_proprietary_angles_order_idx" ON "_content_projects_v_version_proprietary_angles" USING btree ("_order");
  CREATE INDEX "_content_projects_v_version_proprietary_angles_parent_id_idx" ON "_content_projects_v_version_proprietary_angles" USING btree ("_parent_id");
  CREATE INDEX "_content_projects_v_version_uncertainty_map_order_idx" ON "_content_projects_v_version_uncertainty_map" USING btree ("_order");
  CREATE INDEX "_content_projects_v_version_uncertainty_map_parent_id_idx" ON "_content_projects_v_version_uncertainty_map" USING btree ("_parent_id");
  CREATE INDEX "_content_projects_v_version_faq_section_order_idx" ON "_content_projects_v_version_faq_section" USING btree ("_order");
  CREATE INDEX "_content_projects_v_version_faq_section_parent_id_idx" ON "_content_projects_v_version_faq_section" USING btree ("_parent_id");
  CREATE INDEX "_content_projects_v_version_generated_candidates_order_idx" ON "_content_projects_v_version_generated_candidates" USING btree ("_order");
  CREATE INDEX "_content_projects_v_version_generated_candidates_parent_id_idx" ON "_content_projects_v_version_generated_candidates" USING btree ("_parent_id");
  CREATE INDEX "_content_projects_v_version_consistency_issues_order_idx" ON "_content_projects_v_version_consistency_issues" USING btree ("_order");
  CREATE INDEX "_content_projects_v_version_consistency_issues_parent_id_idx" ON "_content_projects_v_version_consistency_issues" USING btree ("_parent_id");
  CREATE INDEX "_content_projects_v_version_messages_order_idx" ON "_content_projects_v_version_messages" USING btree ("_order");
  CREATE INDEX "_content_projects_v_version_messages_parent_id_idx" ON "_content_projects_v_version_messages" USING btree ("_parent_id");
  CREATE INDEX "_content_projects_v_parent_idx" ON "_content_projects_v" USING btree ("parent_id");
  CREATE INDEX "_content_projects_v_version_version_slug_idx" ON "_content_projects_v" USING btree ("version_slug");
  CREATE INDEX "_content_projects_v_version_version_origin_itinerary_idx" ON "_content_projects_v" USING btree ("version_origin_itinerary_id");
  CREATE INDEX "_content_projects_v_version_version_origin_source_idx" ON "_content_projects_v" USING btree ("version_origin_source_id");
  CREATE INDEX "_content_projects_v_version_version_hero_image_idx" ON "_content_projects_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_content_projects_v_version_version_updated_at_idx" ON "_content_projects_v" USING btree ("version_updated_at");
  CREATE INDEX "_content_projects_v_version_version_created_at_idx" ON "_content_projects_v" USING btree ("version_created_at");
  CREATE INDEX "_content_projects_v_version_version__status_idx" ON "_content_projects_v" USING btree ("version__status");
  CREATE INDEX "_content_projects_v_created_at_idx" ON "_content_projects_v" USING btree ("created_at");
  CREATE INDEX "_content_projects_v_updated_at_idx" ON "_content_projects_v" USING btree ("updated_at");
  CREATE INDEX "_content_projects_v_latest_idx" ON "_content_projects_v" USING btree ("latest");
  CREATE INDEX "_content_projects_v_rels_order_idx" ON "_content_projects_v_rels" USING btree ("order");
  CREATE INDEX "_content_projects_v_rels_parent_idx" ON "_content_projects_v_rels" USING btree ("parent_id");
  CREATE INDEX "_content_projects_v_rels_path_idx" ON "_content_projects_v_rels" USING btree ("path");
  CREATE INDEX "_content_projects_v_rels_content_projects_id_idx" ON "_content_projects_v_rels" USING btree ("content_projects_id");
  CREATE INDEX "_content_projects_v_rels_itineraries_id_idx" ON "_content_projects_v_rels" USING btree ("itineraries_id");
  CREATE INDEX "_content_projects_v_rels_destinations_id_idx" ON "_content_projects_v_rels" USING btree ("destinations_id");
  CREATE INDEX "_content_projects_v_rels_properties_id_idx" ON "_content_projects_v_rels" USING btree ("properties_id");
  CREATE INDEX "content_jobs_itinerary_id_idx" ON "content_jobs" USING btree ("itinerary_id_id");
  CREATE INDEX "content_jobs_updated_at_idx" ON "content_jobs" USING btree ("updated_at");
  CREATE INDEX "content_jobs_created_at_idx" ON "content_jobs" USING btree ("created_at");
  CREATE INDEX "source_registry_updated_at_idx" ON "source_registry" USING btree ("updated_at");
  CREATE INDEX "source_registry_created_at_idx" ON "source_registry" USING btree ("created_at");
  CREATE INDEX "editorial_directives_origin_project_idx" ON "editorial_directives" USING btree ("origin_project_id");
  CREATE INDEX "editorial_directives_updated_at_idx" ON "editorial_directives" USING btree ("updated_at");
  CREATE INDEX "editorial_directives_created_at_idx" ON "editorial_directives" USING btree ("created_at");
  CREATE INDEX "destination_name_mappings_mappings_order_idx" ON "destination_name_mappings_mappings" USING btree ("_order");
  CREATE INDEX "destination_name_mappings_mappings_parent_id_idx" ON "destination_name_mappings_mappings" USING btree ("_parent_id");
  CREATE INDEX "destination_name_mappings_mappings_destination_idx" ON "destination_name_mappings_mappings" USING btree ("destination_id");
  CREATE INDEX "payload_locked_documents_rels_content_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("content_projects_id");
  CREATE INDEX "payload_locked_documents_rels_content_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("content_jobs_id");
  CREATE INDEX "payload_locked_documents_rels_source_registry_id_idx" ON "payload_locked_documents_rels" USING btree ("source_registry_id");
  CREATE INDEX "payload_locked_documents_rels_editorial_directives_id_idx" ON "payload_locked_documents_rels" USING btree ("editorial_directives_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "content_projects_target_audience" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_projects_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_projects_proprietary_angles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_projects_uncertainty_map" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_projects_faq_section" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_projects_generated_candidates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_projects_consistency_issues" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_projects_messages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_projects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_projects_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_content_projects_v_version_target_audience" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_content_projects_v_version_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_content_projects_v_version_proprietary_angles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_content_projects_v_version_uncertainty_map" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_content_projects_v_version_faq_section" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_content_projects_v_version_generated_candidates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_content_projects_v_version_consistency_issues" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_content_projects_v_version_messages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_content_projects_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_content_projects_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "source_registry" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "editorial_directives" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_system_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "destination_name_mappings_mappings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "destination_name_mappings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "content_projects_target_audience" CASCADE;
  DROP TABLE "content_projects_sources" CASCADE;
  DROP TABLE "content_projects_proprietary_angles" CASCADE;
  DROP TABLE "content_projects_uncertainty_map" CASCADE;
  DROP TABLE "content_projects_faq_section" CASCADE;
  DROP TABLE "content_projects_generated_candidates" CASCADE;
  DROP TABLE "content_projects_consistency_issues" CASCADE;
  DROP TABLE "content_projects_messages" CASCADE;
  DROP TABLE "content_projects" CASCADE;
  DROP TABLE "content_projects_rels" CASCADE;
  DROP TABLE "_content_projects_v_version_target_audience" CASCADE;
  DROP TABLE "_content_projects_v_version_sources" CASCADE;
  DROP TABLE "_content_projects_v_version_proprietary_angles" CASCADE;
  DROP TABLE "_content_projects_v_version_uncertainty_map" CASCADE;
  DROP TABLE "_content_projects_v_version_faq_section" CASCADE;
  DROP TABLE "_content_projects_v_version_generated_candidates" CASCADE;
  DROP TABLE "_content_projects_v_version_consistency_issues" CASCADE;
  DROP TABLE "_content_projects_v_version_messages" CASCADE;
  DROP TABLE "_content_projects_v" CASCADE;
  DROP TABLE "_content_projects_v_rels" CASCADE;
  DROP TABLE "content_jobs" CASCADE;
  DROP TABLE "source_registry" CASCADE;
  DROP TABLE "editorial_directives" CASCADE;
  DROP TABLE "content_system_settings" CASCADE;
  DROP TABLE "destination_name_mappings_mappings" CASCADE;
  DROP TABLE "destination_name_mappings" CASCADE;
  DROP INDEX "payload_locked_documents_rels_content_projects_id_idx";
  DROP INDEX "payload_locked_documents_rels_content_jobs_id_idx";
  DROP INDEX "payload_locked_documents_rels_source_registry_id_idx";
  DROP INDEX "payload_locked_documents_rels_editorial_directives_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "content_projects_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "content_jobs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "source_registry_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "editorial_directives_id";
  DROP TYPE "public"."enum_content_projects_target_audience";
  DROP TYPE "public"."enum_content_projects_sources_credibility";
  DROP TYPE "public"."enum_content_projects_proprietary_angles_source";
  DROP TYPE "public"."enum_content_projects_uncertainty_map_confidence";
  DROP TYPE "public"."enum_content_projects_generated_candidates_status";
  DROP TYPE "public"."enum_content_projects_consistency_issues_issue_type";
  DROP TYPE "public"."enum_content_projects_consistency_issues_resolution";
  DROP TYPE "public"."enum_content_projects_messages_role";
  DROP TYPE "public"."enum_content_projects_stage";
  DROP TYPE "public"."enum_content_projects_content_type";
  DROP TYPE "public"."enum_content_projects_origin_pathway";
  DROP TYPE "public"."enum_content_projects_processing_status";
  DROP TYPE "public"."enum_content_projects_target_collection";
  DROP TYPE "public"."enum_content_projects_consistency_check_result";
  DROP TYPE "public"."enum_content_projects_freshness_category";
  DROP TYPE "public"."enum_content_projects_status";
  DROP TYPE "public"."enum__content_projects_v_version_target_audience";
  DROP TYPE "public"."enum__content_projects_v_version_sources_credibility";
  DROP TYPE "public"."enum__content_projects_v_version_proprietary_angles_source";
  DROP TYPE "public"."enum__content_projects_v_version_uncertainty_map_confidence";
  DROP TYPE "public"."enum__content_projects_v_version_generated_candidates_status";
  DROP TYPE "public"."enum__content_projects_v_version_consistency_issues_issue_type";
  DROP TYPE "public"."enum__content_projects_v_version_consistency_issues_resolution";
  DROP TYPE "public"."enum__content_projects_v_version_messages_role";
  DROP TYPE "public"."enum__content_projects_v_version_stage";
  DROP TYPE "public"."enum__content_projects_v_version_content_type";
  DROP TYPE "public"."enum__content_projects_v_version_origin_pathway";
  DROP TYPE "public"."enum__content_projects_v_version_processing_status";
  DROP TYPE "public"."enum__content_projects_v_version_target_collection";
  DROP TYPE "public"."enum__content_projects_v_version_consistency_check_result";
  DROP TYPE "public"."enum__content_projects_v_version_freshness_category";
  DROP TYPE "public"."enum__content_projects_v_version_status";
  DROP TYPE "public"."enum_content_jobs_job_type";
  DROP TYPE "public"."enum_content_jobs_status";
  DROP TYPE "public"."enum_content_jobs_created_by";
  DROP TYPE "public"."enum_source_registry_category";
  DROP TYPE "public"."enum_source_registry_check_method";`)
}
