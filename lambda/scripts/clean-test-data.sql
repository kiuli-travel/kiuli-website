-- Kiuli test scrape cleanup script
-- Run via: psql $DATABASE_URL_UNPOOLED -f lambda/scripts/clean-test-data.sql
--
-- Must be run before any test scrape to guarantee a clean baseline.
-- Includes Payload CMS version tables — raw SQL DELETE of main tables
-- does NOT remove version table data, which causes observation dedup to
-- see stale records and double-count on subsequent scrapes.
--
-- WARNING: Deletes ALL itineraries, knowledge base records, and test data.
-- Never run on production with real itinerary data present.

-- 1. Knowledge base (no FK dependencies on other KB tables)
DELETE FROM itinerary_patterns;
DELETE FROM airports;
DELETE FROM service_items;
DELETE FROM transfer_routes;

-- 2. Price observations (main + version tables)
DELETE FROM prop_price_obs;
DELETE FROM _prop_price_obs_v;

-- 3. Reset property accumulatedData (main + version tables)
UPDATE properties SET
  accumulated_data_observation_count = 0,
  accumulated_data_last_observed_at = NULL,
  accumulated_data_typical_nights_median = NULL,
  accumulated_data_typical_nights_min = NULL,
  accumulated_data_typical_nights_max = NULL,
  accumulated_data_price_positioning_observation_count = 0
WHERE id > 0;

UPDATE _properties_v SET
  version_accumulated_data_observation_count = 0,
  version_accumulated_data_last_observed_at = NULL,
  version_accumulated_data_typical_nights_median = NULL,
  version_accumulated_data_typical_nights_min = NULL,
  version_accumulated_data_typical_nights_max = NULL,
  version_accumulated_data_price_positioning_observation_count = 0
WHERE id > 0;

-- 4. Reset activity observation counts
UPDATE activities SET
  observation_count = 0
WHERE id > 0;

-- 5. Job dependencies (image_statuses references itinerary_jobs)
DELETE FROM image_statuses;
DELETE FROM itinerary_jobs;

-- 6. Itineraries (last — other tables may reference itinerary IDs)
DELETE FROM itineraries;

-- Verification — all counts must be 0 or NULL
SELECT 'itineraries' as tbl, COUNT(*) FROM itineraries
UNION ALL SELECT 'transfer_routes', COUNT(*) FROM transfer_routes
UNION ALL SELECT 'airports', COUNT(*) FROM airports
UNION ALL SELECT 'service_items', COUNT(*) FROM service_items
UNION ALL SELECT 'itinerary_patterns', COUNT(*) FROM itinerary_patterns
UNION ALL SELECT 'prop_price_obs', COUNT(*) FROM prop_price_obs
UNION ALL SELECT '_prop_price_obs_v', COUNT(*) FROM _prop_price_obs_v
UNION ALL SELECT 'itinerary_jobs', COUNT(*) FROM itinerary_jobs;

SELECT name, accumulated_data_observation_count FROM properties ORDER BY id;
-- Expected: all rows show 0

SELECT id, name, observation_count FROM activities ORDER BY id;
-- Expected: all rows show 0
