/**
 * @libs/harness — the simulation fabric and product System, generic over
 * a {@link HarnessComposition}. A feature's e2e opens its own slice; the product
 * opens all of it. Hosts are registered runtimes: `in-process`, `bun-webview`.
 *
 * Isomorphism: fabric + `in-process` + system/actions must run under web
 * (product-harness). Node-only seed / HTTP helpers live under `setup/` and
 * `hosts/localhost-http` (`.web.ts` stubs) and are dynamic-imported from tests.
 */

export {
  type HarnessBrowserAppPage,
  type HarnessComposition,
  type HarnessRoomNode,
  noRoomNode,
} from './composition';
export {
  bumpHarnessClientEpoch,
  harnessClientNamespace,
} from './fabric/client-namespace';
export {
  type CreateHarnessOptions,
  createHarness,
  type Harness,
} from './fabric/create-harness';
export {
  createHarnessLoadBalancer,
  HARNESS_LOAD_BALANCER_ID,
  type HarnessLoadBalancer,
  type HarnessLoadBalancerBackendStat,
  type HarnessLoadBalancerRoute,
  type HarnessLoadBalancerSnapshot,
} from './fabric/load-balancer';
export {
  HARNESS_PRIMARY_SERVER_ID,
  type Server,
} from './fabric/server-nodes';
export {
  type HarnessSql,
  handleBoundSqlClient,
  openFreshHarnessClientSql,
  openFreshHarnessServerSql,
  openHarnessServerSqlFromSeedBytes,
  sharedSqlClient,
} from './fabric/sql';
export {
  type HarnessSqlBackend,
  resolveHarnessSqlBackend,
} from './fabric/sql-backend';
export { getHarnessSqlEngines } from './fabric/sql-engines';
export {
  captureSystemSnapshot,
  restoreSystemSnapshot,
  type SystemSnapshotCtx,
} from './fabric/system-snapshot';
export { bunWebviewRuntime } from './hosts/bun-webview';
export { inProcessRuntime } from './hosts/in-process';
export {
  ACTOR_HEADER,
  type HarnessHttpListener,
  listenHarnessHttpServer,
} from './hosts/localhost-http';
export type {
  ProductExtra,
  ProductHostName,
  ProductHttp,
  ProductUi,
} from './hosts/ports';
export { HARNESS_START_MS } from './hosts/ports';
export { registerRealStackBooter } from './hosts/real-stack';
export {
  compositionMigratePostgres,
  migrateCompositionClientSqlite,
  migrateCompositionPostgres,
} from './migrate/migrate-composition';
export {
  type TestFailureSpanOptions,
  testFailureSpans,
} from './observability/test-failure-spans';
export {
  partition,
  resetActor,
  restartApp,
  restoreNetwork,
  spawnActor,
  type UiOp,
  uiOp,
} from './system/actions';
export { actorUi, pollUntil, scenarioAction } from './system/actor-ui';
export {
  type AppleSignInOptions,
  abandonSignIn,
  confirmAccountLink,
  keepSeparateAccount,
  returnToTabs,
  signInAsked,
  signInWithApple,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signInWithProviderAs,
  signOut,
} from './system/auth-actions';
export {
  defineProductSystem,
  globalActionMenuAlwaysVisible,
  noErrorBoundaryAnyActor,
  type ProductHarness,
  type ProductSystem,
} from './system/define-product-system';
export {
  createProductHarness,
  type HarnessActor,
  type ProductProbes,
  type ProductRuntime,
  productExtra,
} from './system/harness';
export {
  type AppleAccountKind,
  accountIdOf,
  actorAppleEmail,
  actorEmail,
  actorLocalSql,
  localAccountIdOf,
  localSignInMethodsOf,
  serverSignInMethodsOf,
  signedInAccountOf,
} from './system/identity';
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
  partitioned,
  visible,
} from './system/observations';
export { captureSnapshot } from './system/probes';
export {
  appleDeletesAccount,
  appleRevokesApp,
  seedProviderAccount,
} from './system/provider-events-actions';
export {
  completeProviderSignIn,
  type ProviderAnswers,
} from './system/provider-walk';
export {
  backToTabs,
  focusActor,
  openAccount,
  openSettings,
} from './system/shell-actions';
export { SHELL_SCENARIO_ACTIONS } from './system/shell-scenario-actions';
export {
  accountMatchPromptShown,
  type ConnectOptions,
  connectSignInMethod,
  openAccountScreen,
  removeSignInMethod,
  signedOutShown,
  signInMethodRowText,
  signInMethodsShown,
  signOutEverywhere,
  tryRemoveSignInMethod,
} from './system/sign-in-method-actions';
export { onScreen, tabsVisible } from './system/ui-reads';
