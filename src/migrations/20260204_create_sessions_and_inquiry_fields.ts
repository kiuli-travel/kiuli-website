import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create enum for sessions status field
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_sessions_status" AS ENUM('active', 'expired');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create sessions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" serial PRIMARY KEY NOT NULL,
      "session_id" varchar NOT NULL,
      "traffic_source" varchar NOT NULL,
      "gclid" varchar,
      "gbraid" varchar,
      "wbraid" varchar,
      "utm_source" varchar,
      "utm_medium" varchar,
      "utm_campaign" varchar,
      "utm_content" varchar,
      "utm_term" varchar,
      "referrer" varchar,
      "landing_page" varchar NOT NULL,
      "user_agent" varchar,
      "ip_address" varchar,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "status" "enum_sessions_status" DEFAULT 'active' NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "sessions_session_id_unique" UNIQUE ("session_id")
    );
  `);

  // Create index on session_id for lookups
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "sessions_session_id_idx" ON "sessions" USING btree ("session_id");
  `);

  // Create standard Payload indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
  `);

  // Add gbraid, wbraid, user_agent columns to inquiries table
  await db.execute(sql`
    ALTER TABLE "inquiries"
    ADD COLUMN IF NOT EXISTS "gbraid" varchar;
  `);
  await db.execute(sql`
    ALTER TABLE "inquiries"
    ADD COLUMN IF NOT EXISTS "wbraid" varchar;
  `);
  await db.execute(sql`
    ALTER TABLE "inquiries"
    ADD COLUMN IF NOT EXISTS "user_agent" varchar;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "inquiries" DROP COLUMN IF EXISTS "user_agent";`);
  await db.execute(sql`ALTER TABLE "inquiries" DROP COLUMN IF EXISTS "wbraid";`);
  await db.execute(sql`ALTER TABLE "inquiries" DROP COLUMN IF EXISTS "gbraid";`);
  await db.execute(sql`DROP TABLE IF EXISTS "sessions";`);
  await db.execute(sql`DROP TYPE IF EXISTS "enum_sessions_status";`);
}
