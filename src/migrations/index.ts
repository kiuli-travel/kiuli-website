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
];
