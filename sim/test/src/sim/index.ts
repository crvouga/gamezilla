/**
 * Product sim system. Hosts own mode (`rntl` → `simRuntime`, `playwright`
 * → `maxRuntime`); {@link openSim} starts this system and returns a {@link Run}.
 */

export {
  partition,
  resetActor,
  restoreNetwork,
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
  createProductSim,
  type ProductProbes,
  type ProductRuntime,
  productExtra,
  type SimActor,
} from './sim';
export {
  noErrorBoundaryAnyActor,
  type ProductSim,
  product,
} from './system';
