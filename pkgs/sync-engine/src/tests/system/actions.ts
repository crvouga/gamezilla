/** Re-export DST action types from the sim harness. */

export type { SimCorruptionVariant } from '../../sim/corruption-faults';
export type {
  DomainOp,
  LibraryAction,
  ServerOp,
  SyncAction,
} from '../../sim/system/actions';
export {
  isDomainOp,
  isLibraryAction,
  isServerOp,
} from '../../sim/system/actions';
