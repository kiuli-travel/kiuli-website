import * as migration_20251107_183848_initial from './20251107_183848_initial';
import * as migration_20260111_214109_v4_pipeline_fields from './20260111_214109_v4_pipeline_fields';

export const migrations = [
  {
    up: migration_20251107_183848_initial.up,
    down: migration_20251107_183848_initial.down,
    name: '20251107_183848_initial',
  },
  {
    up: migration_20260111_214109_v4_pipeline_fields.up,
    down: migration_20260111_214109_v4_pipeline_fields.down,
    name: '20260111_214109_v4_pipeline_fields'
  },
];
