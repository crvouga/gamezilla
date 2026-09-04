/**
 * Re-export checkpoint state helpers from `@product/sim` (shared fabric).
 */
export type {
  CheckpointSessionCtx,
  CheckpointSessionMaps,
} from '@product/sim/fabric/checkpoint-state';
export {
  applyCheckpointFaults,
  collectFaultFields,
  collectRooms,
  collectSqlAndKv,
  importCheckpointSql,
  resetSimClock,
  restoreCheckpointKv,
  restoreCheckpointRooms,
} from '@product/sim/fabric/checkpoint-state';
