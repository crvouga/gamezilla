/**
 * Re-export snapshot sync helpers from `@apps/product/sim` (shared fabric).
 */
export {
  awaitProductSimulatorMutationDrain,
  reconcileServerProfilesFromClients,
} from '@libs/sim-harness/fabric/snapshot-sync';
