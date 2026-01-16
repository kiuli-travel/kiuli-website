/**
 * Migrate embedded imageStatuses from ItineraryJobs to separate ImageStatuses collection
 *
 * Direct database insert approach (bypasses Payload API to avoid relationship resolution issues)
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_6jZvKNcqO7ty@ep-shiny-band-ab1k6dnh-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  console.log('=== ImageStatuses Migration (Direct DB) ===\n');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected to database\n');

  // Get total count from embedded table
  const countResult = await client.query(`
    SELECT COUNT(*) as total FROM itinerary_jobs_image_statuses
  `);
  const totalEmbedded = parseInt(countResult.rows[0].total);
  console.log(`Total embedded imageStatuses: ${totalEmbedded}\n`);

  // Check existing records in new table
  const existingResult = await client.query(`
    SELECT COUNT(*) as total FROM image_statuses
  `);
  const existingCount = parseInt(existingResult.rows[0].total);
  console.log(`Existing ImageStatuses records: ${existingCount}\n`);

  if (existingCount > 0) {
    console.log('WARNING: image_statuses table already has records.');
    console.log('Skipping migration to avoid duplicates.\n');
    await client.end();
    return;
  }

  // Get counts by job
  const jobCounts = await client.query(`
    SELECT _parent_id as job_id, COUNT(*) as count
    FROM itinerary_jobs_image_statuses
    GROUP BY _parent_id
    ORDER BY _parent_id
  `);
  console.log('Embedded counts by job:');
  for (const row of jobCounts.rows) {
    console.log(`  Job ${row.job_id}: ${row.count} images`);
  }
  console.log('');

  // Migrate data directly via SQL
  console.log('Migrating via direct SQL INSERT...\n');

  const insertResult = await client.query(`
    INSERT INTO image_statuses (
      job_id,
      source_s3_key,
      media_id,
      status,
      error,
      started_at,
      completed_at,
      property_name,
      segment_type,
      segment_title,
      day_index,
      segment_index,
      country,
      updated_at,
      created_at
    )
    SELECT
      _parent_id,
      source_s3_key,
      media_id,
      status::text::enum_image_statuses_status,
      error,
      started_at,
      completed_at,
      NULL,  -- property_name (not in source)
      NULL,  -- segment_type (not in source)
      NULL,  -- segment_title (not in source)
      NULL,  -- day_index (not in source)
      NULL,  -- segment_index (not in source)
      NULL,  -- country (not in source)
      NOW(),
      NOW()
    FROM itinerary_jobs_image_statuses
    ORDER BY _parent_id, _order
  `);

  console.log(`Inserted ${insertResult.rowCount} records\n`);

  // Verify migration
  console.log('=== Verification ===\n');

  const finalResult = await client.query(`
    SELECT COUNT(*) as total FROM image_statuses
  `);
  const finalCount = parseInt(finalResult.rows[0].total);

  // Count by job in new table
  const newJobCounts = await client.query(`
    SELECT job_id, COUNT(*) as count
    FROM image_statuses
    GROUP BY job_id
    ORDER BY job_id
  `);
  console.log('Migrated counts by job:');
  for (const row of newJobCounts.rows) {
    console.log(`  Job ${row.job_id}: ${row.count} images`);
  }
  console.log('');

  console.log(`Source (embedded): ${totalEmbedded}`);
  console.log(`Final count in image_statuses: ${finalCount}`);
  console.log(`Match: ${finalCount === totalEmbedded ? 'YES' : 'NO'}`);

  await client.end();
  console.log('\n=== Migration Complete ===');
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
