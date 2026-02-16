import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Enum types for select fields
    CREATE TYPE "public"."enum_brand_voice_gold_standard_content_type" AS ENUM('general', 'article', 'destination_page', 'property_page', 'itinerary_enhancement');
    CREATE TYPE "public"."enum_brand_voice_content_type_guidance_content_type" AS ENUM('itinerary_cluster', 'authority', 'designer_insight', 'destination_page', 'property_page', 'itinerary_enhancement');
    CREATE TYPE "public"."enum_brand_voice_section_guidance_content_type" AS ENUM('destination_page', 'property_page', 'itinerary_enhancement');
    CREATE TYPE "public"."enum_brand_voice_evolution_log_source" AS ENUM('designer_conversation', 'direct_edit', 'performance_insight', 'initial_setup');

    -- Main global table
    CREATE TABLE "brand_voice" (
      "id" serial PRIMARY KEY NOT NULL,
      "voice_summary" varchar,
      "audience" varchar,
      "positioning" varchar,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );

    -- Layer 1: principles array
    CREATE TABLE "brand_voice_principles" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "principle" varchar NOT NULL,
      "explanation" varchar NOT NULL,
      "example" varchar
    );
    CREATE INDEX "brand_voice_principles_order_idx" ON "brand_voice_principles" USING btree ("_order");
    CREATE INDEX "brand_voice_principles_parent_id_idx" ON "brand_voice_principles" USING btree ("_parent_id");
    ALTER TABLE "brand_voice_principles" ADD CONSTRAINT "brand_voice_principles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voice"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    -- Layer 1: banned_phrases array
    CREATE TABLE "brand_voice_banned_phrases" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "phrase" varchar NOT NULL,
      "reason" varchar NOT NULL,
      "alternative" varchar
    );
    CREATE INDEX "brand_voice_banned_phrases_order_idx" ON "brand_voice_banned_phrases" USING btree ("_order");
    CREATE INDEX "brand_voice_banned_phrases_parent_id_idx" ON "brand_voice_banned_phrases" USING btree ("_parent_id");
    ALTER TABLE "brand_voice_banned_phrases" ADD CONSTRAINT "brand_voice_banned_phrases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voice"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    -- Layer 1: anti_patterns array
    CREATE TABLE "brand_voice_anti_patterns" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "pattern" varchar NOT NULL,
      "explanation" varchar NOT NULL
    );
    CREATE INDEX "brand_voice_anti_patterns_order_idx" ON "brand_voice_anti_patterns" USING btree ("_order");
    CREATE INDEX "brand_voice_anti_patterns_parent_id_idx" ON "brand_voice_anti_patterns" USING btree ("_parent_id");
    ALTER TABLE "brand_voice_anti_patterns" ADD CONSTRAINT "brand_voice_anti_patterns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voice"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    -- Layer 1: gold_standard array
    CREATE TABLE "brand_voice_gold_standard" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "excerpt" varchar NOT NULL,
      "content_type" "enum_brand_voice_gold_standard_content_type" DEFAULT 'general',
      "context" varchar,
      "added_at" timestamp(3) with time zone
    );
    CREATE INDEX "brand_voice_gold_standard_order_idx" ON "brand_voice_gold_standard" USING btree ("_order");
    CREATE INDEX "brand_voice_gold_standard_parent_id_idx" ON "brand_voice_gold_standard" USING btree ("_parent_id");
    ALTER TABLE "brand_voice_gold_standard" ADD CONSTRAINT "brand_voice_gold_standard_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voice"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    -- Layer 2: content_type_guidance array
    CREATE TABLE "brand_voice_content_type_guidance" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "content_type" "enum_brand_voice_content_type_guidance_content_type" NOT NULL,
      "label" varchar NOT NULL,
      "objective" varchar NOT NULL,
      "tone_shift" varchar,
      "structural_notes" varchar,
      "temperature" numeric DEFAULT 0.6
    );
    CREATE INDEX "brand_voice_content_type_guidance_order_idx" ON "brand_voice_content_type_guidance" USING btree ("_order");
    CREATE INDEX "brand_voice_content_type_guidance_parent_id_idx" ON "brand_voice_content_type_guidance" USING btree ("_parent_id");
    ALTER TABLE "brand_voice_content_type_guidance" ADD CONSTRAINT "brand_voice_content_type_guidance_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voice"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    -- Layer 3: section_guidance array
    CREATE TABLE "brand_voice_section_guidance" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "content_type" "enum_brand_voice_section_guidance_content_type" NOT NULL,
      "section_key" varchar NOT NULL,
      "section_label" varchar NOT NULL,
      "objective" varchar NOT NULL,
      "tone_notes" varchar,
      "word_count_range" varchar,
      "prompt_template" varchar
    );
    CREATE INDEX "brand_voice_section_guidance_order_idx" ON "brand_voice_section_guidance" USING btree ("_order");
    CREATE INDEX "brand_voice_section_guidance_parent_id_idx" ON "brand_voice_section_guidance" USING btree ("_parent_id");
    ALTER TABLE "brand_voice_section_guidance" ADD CONSTRAINT "brand_voice_section_guidance_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voice"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    -- Layer 3: section_guidance → do_list nested array
    CREATE TABLE "brand_voice_section_guidance_do_list" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "item" varchar NOT NULL
    );
    CREATE INDEX "brand_voice_section_guidance_do_list_order_idx" ON "brand_voice_section_guidance_do_list" USING btree ("_order");
    CREATE INDEX "brand_voice_section_guidance_do_list_parent_id_idx" ON "brand_voice_section_guidance_do_list" USING btree ("_parent_id");
    ALTER TABLE "brand_voice_section_guidance_do_list" ADD CONSTRAINT "brand_voice_section_guidance_do_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voice_section_guidance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    -- Layer 3: section_guidance → dont_list nested array
    CREATE TABLE "brand_voice_section_guidance_dont_list" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "item" varchar NOT NULL
    );
    CREATE INDEX "brand_voice_section_guidance_dont_list_order_idx" ON "brand_voice_section_guidance_dont_list" USING btree ("_order");
    CREATE INDEX "brand_voice_section_guidance_dont_list_parent_id_idx" ON "brand_voice_section_guidance_dont_list" USING btree ("_parent_id");
    ALTER TABLE "brand_voice_section_guidance_dont_list" ADD CONSTRAINT "brand_voice_section_guidance_dont_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voice_section_guidance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    -- Layer 3: section_guidance → examples nested array
    CREATE TABLE "brand_voice_section_guidance_examples" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "before" varchar NOT NULL,
      "after" varchar NOT NULL
    );
    CREATE INDEX "brand_voice_section_guidance_examples_order_idx" ON "brand_voice_section_guidance_examples" USING btree ("_order");
    CREATE INDEX "brand_voice_section_guidance_examples_parent_id_idx" ON "brand_voice_section_guidance_examples" USING btree ("_parent_id");
    ALTER TABLE "brand_voice_section_guidance_examples" ADD CONSTRAINT "brand_voice_section_guidance_examples_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voice_section_guidance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

    -- Layer 4: evolution_log array
    CREATE TABLE "brand_voice_evolution_log" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "date" timestamp(3) with time zone NOT NULL,
      "change" varchar NOT NULL,
      "reason" varchar NOT NULL,
      "source" "enum_brand_voice_evolution_log_source" NOT NULL
    );
    CREATE INDEX "brand_voice_evolution_log_order_idx" ON "brand_voice_evolution_log" USING btree ("_order");
    CREATE INDEX "brand_voice_evolution_log_parent_id_idx" ON "brand_voice_evolution_log" USING btree ("_parent_id");
    ALTER TABLE "brand_voice_evolution_log" ADD CONSTRAINT "brand_voice_evolution_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_voice"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "brand_voice_section_guidance_examples" CASCADE;
    DROP TABLE IF EXISTS "brand_voice_section_guidance_dont_list" CASCADE;
    DROP TABLE IF EXISTS "brand_voice_section_guidance_do_list" CASCADE;
    DROP TABLE IF EXISTS "brand_voice_evolution_log" CASCADE;
    DROP TABLE IF EXISTS "brand_voice_section_guidance" CASCADE;
    DROP TABLE IF EXISTS "brand_voice_content_type_guidance" CASCADE;
    DROP TABLE IF EXISTS "brand_voice_gold_standard" CASCADE;
    DROP TABLE IF EXISTS "brand_voice_anti_patterns" CASCADE;
    DROP TABLE IF EXISTS "brand_voice_banned_phrases" CASCADE;
    DROP TABLE IF EXISTS "brand_voice_principles" CASCADE;
    DROP TABLE IF EXISTS "brand_voice" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_brand_voice_gold_standard_content_type";
    DROP TYPE IF EXISTS "public"."enum_brand_voice_content_type_guidance_content_type";
    DROP TYPE IF EXISTS "public"."enum_brand_voice_section_guidance_content_type";
    DROP TYPE IF EXISTS "public"."enum_brand_voice_evolution_log_source";
  `)
}
