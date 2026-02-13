import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Baseline: no SQL to run. All tables created via push mode during development.
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // No rollback — this is a snapshot checkpoint.
}
