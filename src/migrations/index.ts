import * as migration_20251107_183848_initial from './20251107_183848_initial';
import * as migration_20260111_214109_v4_pipeline_fields from './20260111_214109_v4_pipeline_fields';
import * as migration_20260113_102418_itinerary_schema_v3 from './20260113_102418_itinerary_schema_v3';
import * as migration_20260113_124555_v6_schema_updates from './20260113_124555_v6_schema_updates';

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
    name: '20260113_124555_v6_schema_updates'
  },
];
