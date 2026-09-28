/**
 * Re-export snapshot sync helpers from `@apps/product/harness` (shared fabric).
 */
export {
  awaitProductHarnessMutationDrain,
  reconcileServerProfilesFromClients,
} from '@libs/harness/fabric/snapshot-sync';
