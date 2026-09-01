/**
 * Product sim system. Worlds are framework-owned:
 * {@link defineProductSystem} + `openWorld` / `assertSample` / `replay`.
 * {@link openSim} is a thin wrapper that opens this system and exposes actors.
 */

export {
  defineProductSystem,
  PRODUCT_SYSTEM,
  type DefineProductSystemOpts,
  type ProductSystemDef,
  type ProductSystemWorld,
} from './define-product-system';
export { PRODUCT_SIM, PRODUCT_WARMUP } from './node-kinds';
export {
  createProductSystem,
  productSim,
  requireSim,
  type ProductSystem,
  type ProductSystemOpts,
} from './system';
