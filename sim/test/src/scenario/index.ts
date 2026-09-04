/**
 * Product sim system. Hosts own fidelity (`rntl` → `simHost`, `playwright`
 * → `maxHost`); {@link openSim} starts this system and returns a {@link Script}.
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
  actorHtml,
  actorIds,
  anyActor,
  caps,
  capturedSnapshot,
  clientIds,
  nodeLayout,
  nodeText,
  oauthTokenLength,
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
export {
  noErrorBoundaryAnyActor,
  type ProductSurface,
  product,
} from './system';
