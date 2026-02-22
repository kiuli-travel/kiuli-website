import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS availability_cache (
      id SERIAL PRIMARY KEY,
      property_id TEXT NOT NULL,
      res_request_property_id TEXT NOT NULL,
      room_type_id TEXT,
      check_in DATE NOT NULL,
      check_out DATE NOT NULL,
      adults INTEGER DEFAULT 2,
      children INTEGER DEFAULT 0,
      available BOOLEAN,
      units_available INTEGER,
      rate_per_night NUMERIC(10,2),
      rate_total NUMERIC(10,2),
      currency TEXT DEFAULT 'USD',
      rate_type TEXT,
      checked_at TIMESTAMPTZ DEFAULT NOW(),
      ttl_minutes INTEGER DEFAULT 60,
      UNIQUE(property_id, room_type_id, check_in, check_out, adults, children)
    )
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS availability_cache`)
}
