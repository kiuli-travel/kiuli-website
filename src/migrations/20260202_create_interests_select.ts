import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create the enum for interests hasMany select field
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_inquiries_interests" AS ENUM(
        'migration', 'gorillas', 'big_cats', 'beach', 'culture', 'walking',
        'wine_culinary', 'luxury_camp', 'celebration', 'photography', 'horse_riding', 'other'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create the join table for interests hasMany select
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "inquiries_interests" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_inquiries_interests" NOT NULL,
      "id" serial PRIMARY KEY
    );
  `);

  // Add indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "inquiries_interests_order_idx" ON "inquiries_interests" ("order");
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "inquiries_interests_parent_id_idx" ON "inquiries_interests" ("parent_id");
  `);

  // Add foreign key
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "inquiries_interests"
        ADD CONSTRAINT "inquiries_interests_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "inquiries"("id") ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "inquiries_interests";`);
  await db.execute(sql`DROP TYPE IF EXISTS "enum_inquiries_interests";`);
}
