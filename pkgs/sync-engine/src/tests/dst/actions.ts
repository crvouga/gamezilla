/** Re-export DST action types from the sim harness. */
export type {
  DomainOp,
  DstAction,
  LibraryAction,
  ServerOp,
} from '../../sim/dst/actions';
export {
  isDomainOp,
  isLibraryAction,
  isServerOp,
} from '../../sim/dst/actions';
export type { SimCorruptionVariant } from '../../sim/corruption-faults';
