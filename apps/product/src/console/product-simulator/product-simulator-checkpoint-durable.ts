/**
 * Re-export client durable helpers from `@apps/product/sim` (shared fabric).
 */
export {
  clearProductSimulatorClientDurable,
  dumpProductSimulatorClientDurable,
  restoreProductSimulatorClientDurable,
} from '@libs/sim-harness/fabric/client-durable';
