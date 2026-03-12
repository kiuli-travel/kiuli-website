-- ============================================================================
-- KIULI CLEAN SLATE RESET
-- ============================================================================
-- Deletes ALL itineraries and ALL derived content, returning the system to
-- an empty state ready for fresh scraping.
--
-- PRESERVES: Users, Pages, Categories, TripTypes, Authors, Globals (Header,
--            Footer, BrandVoice, ContentSystemSettings, PropertyNameMappings,
--            LocationMappings), Airports, Designers, Sessions, Inquiries
--
-- DELETES: Itineraries, ItineraryJobs, ImageStatuses, Media (all scraped),
--          ContentProjects, ContentJobs, Posts, Destinations, Properties,
--          TransferRoutes, Activities, ItineraryPatterns, Notifications,
--          ContentEmbeddings, ServiceItems, EditorialDirectives,
--          PropertyObservations, and all version tables
--
-- DEPENDENCY ORDER: Children before parents, respecting CASCADE/SET NULL FKs
-- ============================================================================

-- Phase 1: Content engine derived data (no blocking FKs)
DELETE FROM content_embeddings;
DELETE FROM editorial_directives;

-- Phase 2: Pipeline tracking
DELETE FROM image_statuses;
DELETE FROM content_jobs;
DELETE FROM notifications;

-- Phase 3: Content output
DELETE FROM posts;           -- CASCADE: posts_faq_items, posts_populated_authors, posts_rels, _posts_v_rels
DELETE FROM content_projects; -- CASCADE: messages, sources, consistency_issues, faq_section, etc.

-- Phase 4: Pipeline jobs
DELETE FROM itinerary_jobs;  -- CASCADE: itinerary_jobs_previous_versions, itinerary_jobs_rels

-- Phase 5: Knowledge base
DELETE FROM itinerary_patterns; -- CASCADE: property_sequence, transfer_sequence, rels
DELETE FROM activities;         -- CASCADE: activities_rels, activities_suitability
DELETE FROM service_items;      -- CASCADE: service_items_rels
DELETE FROM transfer_routes;    -- CASCADE: transfer_routes_observations, transfer_routes_airlines
DELETE FROM prop_price_obs;
DELETE FROM prop_room_obs;
DELETE FROM properties;         -- CASCADE: properties_gallery, room_types, faq_items, rels, etc.

-- Phase 6: Airports BEFORE destinations (airports.country_id has NOT NULL constraint)
DELETE FROM airports;

-- Phase 7: Destinations (after properties and airports)
DELETE FROM destinations;       -- CASCADE: destinations_highlights, faq_items, rels

-- Phase 8: Core data
DELETE FROM itineraries;        -- CASCADE: itineraries_days, blocks_*, faq_items, rels, etc.
-- Media: keep items referenced by pages (homepage hero, value prop, etc.)
DELETE FROM media WHERE id NOT IN (
  SELECT background_image_id FROM pages_blocks_home_hero WHERE background_image_id IS NOT NULL
  UNION SELECT background_video_id FROM pages_blocks_home_hero WHERE background_video_id IS NOT NULL
  UNION SELECT image_id FROM pages_blocks_value_proposition WHERE image_id IS NOT NULL
  UNION SELECT media_id FROM pages_blocks_media_block WHERE media_id IS NOT NULL
  UNION SELECT hero_media_id FROM pages WHERE hero_media_id IS NOT NULL
  UNION SELECT meta_image_id FROM pages WHERE meta_image_id IS NOT NULL
);

-- Phase 8: Version tables (Payload CMS soft-delete history)
DELETE FROM _itineraries_v;
DELETE FROM _content_projects_v;
DELETE FROM _posts_v;
DELETE FROM _destinations_v;
DELETE FROM _properties_v;
DELETE FROM _prop_price_obs_v;
DELETE FROM _prop_room_obs_v;

-- Phase 9: Clean up locked documents for deleted collections
DELETE FROM payload_locked_documents_rels
WHERE itineraries_id IS NOT NULL
   OR media_id IS NOT NULL
   OR destinations_id IS NOT NULL
   OR properties_id IS NOT NULL
   OR itinerary_jobs_id IS NOT NULL
   OR itinerary_patterns_id IS NOT NULL
   OR activities_id IS NOT NULL
   OR transfer_routes_id IS NOT NULL;

DELETE FROM payload_locked_documents
WHERE id NOT IN (
  SELECT DISTINCT document_id FROM payload_locked_documents_rels WHERE document_id IS NOT NULL
);
