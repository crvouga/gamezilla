/**
 * Product sim system. Hosts own fidelity (`simHost` / `maxHost`);
 * {@link openSim} starts this system and returns a {@link Run}.
 */

export {
  heal,
  partition,
  passTime,
  resetActor,
  spawnActor,
  type UiOp,
  type UiWait,
  type UiWaitKind,
  uiOp,
  uiWait,
} from './actions';
export {
  actor,
  actorHtml,
  actorIds,
  anyActor,
  caps,
  capturedSnapshot,
  clientIds,
  nodeLayout,
  nodeText,
  oauthTokenLength,
  PRODUCT_PROPERTIES,
  partitioned,
  visible,
} from './observations';
export { captureSnapshot, devOauthSignIn } from './probes';
export {
  createProductSurface,
  type ProductProbes,
  type ProductRuntime,
  productExtra,
  type SimActorHandle,
} from './surface';
export { type ProductSurface, product } from './system';
