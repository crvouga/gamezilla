/**
 * Product sim system. Hosts own fidelity (`simHost` / `maxHost`);
 * {@link openSim} starts this system and returns a {@link Run}.
 */

export {
  heal,
  partition,
  resetActor,
  spawnActor,
  type UiOp,
  uiOp,
} from './actions';
export {
  actor,
  anyActor,
  caps,
  clientIds,
  PRODUCT_PROPERTIES,
  partitioned,
} from './observations';
export {
  createProductSurface,
  type ProductRuntime,
  type SimActorHandle,
} from './surface';
export { type ProductSurface, product } from './system';
