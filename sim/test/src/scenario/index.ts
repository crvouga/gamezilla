/**
 * Product sim system. Worlds are framework-owned:
 * {@link defineProductSystem} + `openWorld` / `runScenario` / `replay`.
 * {@link openSim} is a thin wrapper that opens this system and exposes actors.
 */

export {
  type DefineProductSystemOpts,
  defineProductSystem,
  PRODUCT_SYSTEM,
  type ProductSimExtension,
  type ProductSystemDef,
  type ProductSystemWorld,
} from './define-product-system';
export {
  createProductSimNode,
  type ProductSimHandle,
  productSimNode,
} from './node-kinds';
export { type ProductSystemOpts } from './system';
