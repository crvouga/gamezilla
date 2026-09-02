/**
 * Model helpers and PBT constants — canonical copy lives in `sim/scenario/world-model`.
 */
export type { WorldModel, WorldReal } from '../../sim/scenario/world-model';
export {
  AUTH_STATUSES,
  applyActionToModel,
  CLIENT_IDS,
  CORRUPTION_VARIANTS,
  CRASH_EVENTS,
  clientLive,
  domainOp,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  initialWorldModel,
  modelAllowsAction,
  PUBSUB_FAULTS,
  SCHEMA_VARIANTS,
  STORAGE_TAMPERS,
  serverOp,
  WORLD_PBT_CRASH_EVENTS,
} from '../../sim/scenario/world-model';
