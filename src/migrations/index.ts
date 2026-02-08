import * as migration_20251107_183848_initial from './20251107_183848_initial';
import * as migration_20260111_214109_v4_pipeline_fields from './20260111_214109_v4_pipeline_fields';
import * as migration_20260113_102418_itinerary_schema_v3 from './20260113_102418_itinerary_schema_v3';
import * as migration_20260113_124555_v6_schema_updates from './20260113_124555_v6_schema_updates';
import * as migration_20260114_181510_schema_valid_field from './20260114_181510_schema_valid_field';
import * as migration_20260116_create_image_statuses from './20260116_create_image_statuses';
import * as migration_20260120_add_reviewed_to_segments from './20260120_add_reviewed_to_segments';
import * as migration_20260120_add_reviewed_to_faqs from './20260120_add_reviewed_to_faqs';
import * as migration_20260120_add_version_to_jobs from './20260120_add_version_to_jobs';
import * as migration_20260120_create_voice_configuration from './20260120_create_voice_configuration';
import * as migration_20260120_create_destinations from './20260120_create_destinations';
import * as migration_20260120_create_trip_types from './20260120_create_trip_types';
import * as migration_20260120_add_root_twofield_pattern from './20260120_add_root_twofield_pattern';
import * as migration_20260120_add_overview_investment_twofield from './20260120_add_overview_investment_twofield';
import * as migration_20260120_add_segments_twofield_pattern from './20260120_add_segments_twofield_pattern';
import * as migration_20260120_add_faq_twofield_pattern from './20260120_add_faq_twofield_pattern';
import * as migration_20260120_add_relationship_fields from './20260120_add_relationship_fields';
import * as migration_20260120_seed_segment_description_voice from './20260120_seed_segment_description_voice';
import * as migration_20260120_seed_faq_answer_voice from './20260120_seed_faq_answer_voice';
import * as migration_20260120_seed_meta_description_voice from './20260120_seed_meta_description_voice';
import * as migration_20260120_seed_day_title_voice from './20260120_seed_day_title_voice';
import * as migration_20260120_seed_investment_includes_voice from './20260120_seed_investment_includes_voice';
import * as migration_20260121_seed_overview_summary_voice from './20260121_seed_overview_summary_voice';
import * as migration_20260121_seed_why_kiuli_voice from './20260121_seed_why_kiuli_voice';
import * as migration_20260128_add_video_scraping_tracking from './20260128_add_video_scraping_tracking';
import * as migration_20260202_add_contact_consent from './20260202_add_contact_consent';
import * as migration_20260202_make_phone_country_code_nullable from './20260202_make_phone_country_code_nullable';
import * as migration_20260202_make_primary_interest_nullable from './20260202_make_primary_interest_nullable';
import * as migration_20260202_create_interests_select from './20260202_create_interests_select';
import * as migration_20260204_create_sessions_and_inquiry_fields from './20260204_create_sessions_and_inquiry_fields';
import * as migration_20260205_drop_primary_interest from './20260205_drop_primary_interest';
import * as migration_20260205_create_designers_and_seed from './20260205_create_designers_and_seed';
import * as migration_20260207_add_base_fields_for_hook from './20260207_add_base_fields_for_hook';
import * as migration_20260207_add_seo_fields from './20260207_add_seo_fields';
import * as migration_20260207_add_destination_fields from './20260207_add_destination_fields';
import * as migration_20260208_add_destinations_highlights_table from './20260208_add_destinations_highlights_table';
import * as migration_20260208_fix_destinations_versioning_schema from './20260208_fix_destinations_versioning_schema';
import * as migration_20260208_create_authors_collection from './20260208_create_authors_collection';
import * as migration_20260208_update_posts_for_articles from './20260208_update_posts_for_articles';

export const migrations = [
  {
    up: migration_20251107_183848_initial.up,
    down: migration_20251107_183848_initial.down,
    name: '20251107_183848_initial',
  },
  {
    up: migration_20260111_214109_v4_pipeline_fields.up,
    down: migration_20260111_214109_v4_pipeline_fields.down,
    name: '20260111_214109_v4_pipeline_fields',
  },
  {
    up: migration_20260113_102418_itinerary_schema_v3.up,
    down: migration_20260113_102418_itinerary_schema_v3.down,
    name: '20260113_102418_itinerary_schema_v3',
  },
  {
    up: migration_20260113_124555_v6_schema_updates.up,
    down: migration_20260113_124555_v6_schema_updates.down,
    name: '20260113_124555_v6_schema_updates',
  },
  {
    up: migration_20260114_181510_schema_valid_field.up,
    down: migration_20260114_181510_schema_valid_field.down,
    name: '20260114_181510_schema_valid_field',
  },
  {
    up: migration_20260116_create_image_statuses.up,
    down: migration_20260116_create_image_statuses.down,
    name: '20260116_create_image_statuses'
  },
  {
    up: migration_20260120_add_reviewed_to_segments.up,
    down: migration_20260120_add_reviewed_to_segments.down,
    name: '20260120_add_reviewed_to_segments'
  },
  {
    up: migration_20260120_add_reviewed_to_faqs.up,
    down: migration_20260120_add_reviewed_to_faqs.down,
    name: '20260120_add_reviewed_to_faqs'
  },
  {
    up: migration_20260120_add_version_to_jobs.up,
    down: migration_20260120_add_version_to_jobs.down,
    name: '20260120_add_version_to_jobs'
  },
  {
    up: migration_20260120_create_voice_configuration.up,
    down: migration_20260120_create_voice_configuration.down,
    name: '20260120_create_voice_configuration'
  },
  {
    up: migration_20260120_create_destinations.up,
    down: migration_20260120_create_destinations.down,
    name: '20260120_create_destinations'
  },
  {
    up: migration_20260120_create_trip_types.up,
    down: migration_20260120_create_trip_types.down,
    name: '20260120_create_trip_types'
  },
  {
    up: migration_20260120_add_root_twofield_pattern.up,
    down: migration_20260120_add_root_twofield_pattern.down,
    name: '20260120_add_root_twofield_pattern'
  },
  {
    up: migration_20260120_add_overview_investment_twofield.up,
    down: migration_20260120_add_overview_investment_twofield.down,
    name: '20260120_add_overview_investment_twofield'
  },
  {
    up: migration_20260120_add_segments_twofield_pattern.up,
    down: migration_20260120_add_segments_twofield_pattern.down,
    name: '20260120_add_segments_twofield_pattern'
  },
  {
    up: migration_20260120_add_faq_twofield_pattern.up,
    down: migration_20260120_add_faq_twofield_pattern.down,
    name: '20260120_add_faq_twofield_pattern'
  },
  {
    up: migration_20260120_add_relationship_fields.up,
    down: migration_20260120_add_relationship_fields.down,
    name: '20260120_add_relationship_fields'
  },
  {
    up: migration_20260120_seed_segment_description_voice.up,
    down: migration_20260120_seed_segment_description_voice.down,
    name: '20260120_seed_segment_description_voice'
  },
  {
    up: migration_20260120_seed_faq_answer_voice.up,
    down: migration_20260120_seed_faq_answer_voice.down,
    name: '20260120_seed_faq_answer_voice'
  },
  {
    up: migration_20260120_seed_meta_description_voice.up,
    down: migration_20260120_seed_meta_description_voice.down,
    name: '20260120_seed_meta_description_voice'
  },
  {
    up: migration_20260120_seed_day_title_voice.up,
    down: migration_20260120_seed_day_title_voice.down,
    name: '20260120_seed_day_title_voice'
  },
  {
    up: migration_20260120_seed_investment_includes_voice.up,
    down: migration_20260120_seed_investment_includes_voice.down,
    name: '20260120_seed_investment_includes_voice'
  },
  {
    up: migration_20260121_seed_overview_summary_voice.up,
    down: migration_20260121_seed_overview_summary_voice.down,
    name: '20260121_seed_overview_summary_voice'
  },
  {
    up: migration_20260121_seed_why_kiuli_voice.up,
    down: migration_20260121_seed_why_kiuli_voice.down,
    name: '20260121_seed_why_kiuli_voice'
  },
  {
    up: migration_20260128_add_video_scraping_tracking.up,
    down: migration_20260128_add_video_scraping_tracking.down,
    name: '20260128_add_video_scraping_tracking'
  },
  {
    up: migration_20260202_add_contact_consent.up,
    down: migration_20260202_add_contact_consent.down,
    name: '20260202_add_contact_consent'
  },
  {
    up: migration_20260202_make_phone_country_code_nullable.up,
    down: migration_20260202_make_phone_country_code_nullable.down,
    name: '20260202_make_phone_country_code_nullable'
  },
  {
    up: migration_20260202_make_primary_interest_nullable.up,
    down: migration_20260202_make_primary_interest_nullable.down,
    name: '20260202_make_primary_interest_nullable'
  },
  {
    up: migration_20260202_create_interests_select.up,
    down: migration_20260202_create_interests_select.down,
    name: '20260202_create_interests_select'
  },
  {
    up: migration_20260204_create_sessions_and_inquiry_fields.up,
    down: migration_20260204_create_sessions_and_inquiry_fields.down,
    name: '20260204_create_sessions_and_inquiry_fields'
  },
  {
    up: migration_20260205_drop_primary_interest.up,
    down: migration_20260205_drop_primary_interest.down,
    name: '20260205_drop_primary_interest'
  },
  {
    up: migration_20260205_create_designers_and_seed.up,
    down: migration_20260205_create_designers_and_seed.down,
    name: '20260205_create_designers_and_seed'
  },
  {
    up: migration_20260207_add_base_fields_for_hook.up,
    down: migration_20260207_add_base_fields_for_hook.down,
    name: '20260207_add_base_fields_for_hook'
  },
  {
    up: migration_20260207_add_seo_fields.up,
    down: migration_20260207_add_seo_fields.down,
    name: '20260207_add_seo_fields'
  },
  {
    up: migration_20260207_add_destination_fields.up,
    down: migration_20260207_add_destination_fields.down,
    name: '20260207_add_destination_fields'
  },
  {
    up: migration_20260208_add_destinations_highlights_table.up,
    down: migration_20260208_add_destinations_highlights_table.down,
    name: '20260208_add_destinations_highlights_table'
  },
  {
    up: migration_20260208_fix_destinations_versioning_schema.up,
    down: migration_20260208_fix_destinations_versioning_schema.down,
    name: '20260208_fix_destinations_versioning_schema'
  },
  {
    up: migration_20260208_create_authors_collection.up,
    down: migration_20260208_create_authors_collection.down,
    name: '20260208_create_authors_collection'
  },
  {
    up: migration_20260208_update_posts_for_articles.up,
    down: migration_20260208_update_posts_for_articles.down,
    name: '20260208_update_posts_for_articles'
  },
];
