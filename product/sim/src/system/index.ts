/**
 * Product system. Hosts are registered runtimes (`in-process`, `bun-webview`,
 * `playwright`). Consumers call `product.run({ seed, runtime })`.
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
