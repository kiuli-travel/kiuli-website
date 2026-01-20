import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create voice_configuration table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "voice_configuration" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "description" varchar,
      "system_prompt" varchar NOT NULL,
      "user_prompt_template" varchar NOT NULL,
      "max_words" numeric,
      "temperature" numeric DEFAULT 0.7,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  // Create unique index on name
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "voice_configuration_name_idx"
    ON "voice_configuration" USING btree ("name");
  `);

  // Create voice_configuration_examples table for array field
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "voice_configuration_examples" (
      "id" serial PRIMARY KEY NOT NULL,
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "before" varchar NOT NULL,
      "after" varchar NOT NULL
    );
  `);

  // Add foreign key for examples
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "voice_configuration_examples"
      ADD CONSTRAINT "voice_configuration_examples_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."voice_configuration"("id")
      ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create indexes for examples
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "voice_configuration_examples_order_idx"
    ON "voice_configuration_examples" USING btree ("_order");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "voice_configuration_examples_parent_id_idx"
    ON "voice_configuration_examples" USING btree ("_parent_id");
  `);

  // Create voice_configuration_anti_patterns table for array field
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "voice_configuration_anti_patterns" (
      "id" serial PRIMARY KEY NOT NULL,
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "pattern" varchar NOT NULL,
      "reason" varchar
    );
  `);

  // Add foreign key for anti_patterns
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "voice_configuration_anti_patterns"
      ADD CONSTRAINT "voice_configuration_anti_patterns_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."voice_configuration"("id")
      ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create indexes for anti_patterns
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "voice_configuration_anti_patterns_order_idx"
    ON "voice_configuration_anti_patterns" USING btree ("_order");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "voice_configuration_anti_patterns_parent_id_idx"
    ON "voice_configuration_anti_patterns" USING btree ("_parent_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "voice_configuration_anti_patterns";`);
  await db.execute(sql`DROP TABLE IF EXISTS "voice_configuration_examples";`);
  await db.execute(sql`DROP TABLE IF EXISTS "voice_configuration";`);
}
