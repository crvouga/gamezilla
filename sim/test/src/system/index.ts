/**
 * Product sim system. Worlds are framework-owned:
 * {@link defineProductSystem} + `openWorld` / `assertSample` / `replay`.
 * {@link openSim} is a thin wrapper that opens this system and exposes actors.
 */

export {
  type DefineProductSystemOpts,
  defineProductSystem,
  PRODUCT_SYSTEM,
  type ProductSystemDef,
  type ProductSystemWorld,
} from './define-product-system';
export { productSimNode } from './node-kinds';
export {
  createProductSystem,
  type ProductSystem,
  type ProductSystemOpts,
  productSim,
} from './system';
