/**
 * Re-export snapshot sync helpers from `@apps/product/sim` (shared fabric).
 */
export {
  awaitProductSimulatorMutationDrain,
  reconcileServerProfilesFromClients,
} from '@apps/product/sim/fabric/snapshot-sync';
