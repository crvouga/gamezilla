/**
 * Re-export checkpoint state helpers from `@apps/product/sim` (shared fabric).
 */
export type {
  CheckpointSessionCtx,
  CheckpointSessionMaps,
} from '@apps/product/sim/fabric/checkpoint-state';
export {
  applyCheckpointFaults,
  collectFaultFields,
  collectRooms,
  collectSqlAndKv,
  importCheckpointSql,
  resetSimClock,
  restoreCheckpointKv,
  restoreCheckpointRooms,
} from '@apps/product/sim/fabric/checkpoint-state';
