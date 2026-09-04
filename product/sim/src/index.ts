/**
 * @product/sim — shared product simulation fabric + System.
 *
 * Console and test couple only to this package's public API (`product.run`,
 * actions, reads). Hosts are registered runtimes: `in-process`, `bun-webview`,
 * `playwright`.
 */

export {
  partition,
  resetActor,
  restoreNetwork,
  spawnActor,
  type UiOp,
  uiOp,
} from './system/actions';
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
} from './system/observations';
export { captureSnapshot, devOauthSignIn } from './system/probes';
export {
  createProductSim,
  type ProductProbes,
  type ProductRuntime,
  productExtra,
  type SimActor,
} from './system/sim';
export {
  noErrorBoundaryAnyActor,
  type ProductSim,
  product,
} from './system/system';

export type {
  ProductExtra,
  ProductHostName,
  ProductHttp,
  ProductUi,
} from './hosts/ports';
export { SIM_START_MS } from './hosts/ports';
export { inProcessRuntime } from './hosts/in-process';
export { bunWebviewRuntime } from './hosts/bun-webview';
export { playwrightRuntime } from './hosts/playwright';
export {
  listenSimHttpServer,
  type SimHttpListener,
} from './hosts/localhost-http';

export {
  bumpSimClientEpoch,
  createSim,
  type CreateSimOptions,
  type Sim,
  simClientNamespace,
  type Server,
} from './fabric/create-sim';
export {
  handleBoundSqlClient,
  openFreshSimClientSql,
  openFreshSimServerSql,
  openSimServerSqlFromSeedBytes,
  type SimSql,
  sharedSqlClient,
} from './fabric/sim-sql';
export {
  resolveSimSqlBackend,
  type SimSqlBackend,
} from './fabric/sim-sql-backend';
export { getSimSqlEngines } from './fabric/sim-sql-engines';
export {
  captureSystemSnapshot,
  restoreSystemSnapshot,
  type SystemSnapshotCtx,
} from './fabric/system-snapshot';
