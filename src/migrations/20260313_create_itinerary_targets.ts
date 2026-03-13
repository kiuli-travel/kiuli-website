import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create the itinerary_targets table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "itinerary_targets" (
      "id" serial PRIMARY KEY NOT NULL,
      "number" numeric NOT NULL,
      "name" varchar NOT NULL,
      "priority" varchar NOT NULL,
      "set" varchar NOT NULL,
      "duration" varchar,
      "countries" varchar,
      "seasonality" varchar,
      "category" varchar,
      "experience_description" varchar,
      "property_guidance" varchar,
      "seo_keywords" varchar,
      "status" varchar DEFAULT 'not_started' NOT NULL,
      "assigned_designer_id" integer,
      "itrvl_url" varchar,
      "linked_itinerary_id" integer,
      "notes" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      UNIQUE("number")
    );
  `)

  // Add foreign key constraints
  await db.execute(sql`
    ALTER TABLE "itinerary_targets"
      ADD CONSTRAINT "itinerary_targets_assigned_designer_id_fk"
      FOREIGN KEY ("assigned_designer_id") REFERENCES "designers"("id") ON DELETE SET NULL;
  `)

  await db.execute(sql`
    ALTER TABLE "itinerary_targets"
      ADD CONSTRAINT "itinerary_targets_linked_itinerary_id_fk"
      FOREIGN KEY ("linked_itinerary_id") REFERENCES "itineraries"("id") ON DELETE SET NULL;
  `)

  // Create indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "itinerary_targets_created_at_idx" ON "itinerary_targets" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "itinerary_targets_status_idx" ON "itinerary_targets" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "itinerary_targets_priority_idx" ON "itinerary_targets" USING btree ("priority");
    CREATE INDEX IF NOT EXISTS "itinerary_targets_set_idx" ON "itinerary_targets" USING btree ("set");
  `)

  // Add to payload_locked_documents_rels
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "itinerary_targets_id" integer;
  `)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_itinerary_targets_fk"
      FOREIGN KEY ("itinerary_targets_id") REFERENCES "itinerary_targets"("id") ON DELETE CASCADE;
  `)

  // Add to payload_preferences_rels
  await db.execute(sql`
    ALTER TABLE "payload_preferences_rels"
      ADD COLUMN IF NOT EXISTS "itinerary_targets_id" integer;
  `)

  await db.execute(sql`
    ALTER TABLE "payload_preferences_rels"
      ADD CONSTRAINT "payload_preferences_rels_itinerary_targets_fk"
      FOREIGN KEY ("itinerary_targets_id") REFERENCES "itinerary_targets"("id") ON DELETE CASCADE;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Remove foreign key columns from rels tables
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "itinerary_targets_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "itinerary_targets_id";
  `)

  // Drop the table
  await db.execute(sql`
    DROP TABLE IF EXISTS "itinerary_targets";
  `)
}
