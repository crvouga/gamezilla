/**
 * @libs/sim-harness — the simulation fabric and product System, generic over
 * a {@link SimComposition}. A feature's e2e opens its own slice; the product
 * opens all of it. Hosts are registered runtimes: `in-process`, `bun-webview`.
 *
 * Isomorphism: fabric + `in-process` + system/actions must run under web
 * (product-simulator). Node-only seed / HTTP helpers live under `setup/` and
 * `hosts/localhost-http` (`.web.ts` stubs) and are dynamic-imported from tests.
 */

export {
  noRoomNode,
  type SimBrowserAppPage,
  type SimComposition,
  type SimRoomNode,
} from './composition';
export {
  type CreateSimOptions,
  createSim,
  type Sim,
} from './fabric/create-sim';
export {
  bumpSimClientEpoch,
  simClientNamespace,
} from './fabric/sim-client-namespace';
export {
  createSimLoadBalancer,
  SIM_LOAD_BALANCER_ID,
  type SimLoadBalancer,
  type SimLoadBalancerBackendStat,
  type SimLoadBalancerRoute,
  type SimLoadBalancerSnapshot,
} from './fabric/sim-load-balancer';
export {
  type Server,
  SIM_PRIMARY_SERVER_ID,
} from './fabric/sim-server-nodes';
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
export { bunWebviewRuntime } from './hosts/bun-webview';
export { inProcessRuntime } from './hosts/in-process';
export {
  ACTOR_HEADER,
  listenSimHttpServer,
  type SimHttpListener,
} from './hosts/localhost-http';
export type {
  ProductExtra,
  ProductHostName,
  ProductHttp,
  ProductUi,
} from './hosts/ports';
export { SIM_START_MS } from './hosts/ports';
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
  type ProductSim,
  type ProductSystem,
} from './system/define-product-system';
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
  oauthTokenLength,
  partitioned,
  visible,
} from './system/observations';
export { captureSnapshot, googleOauthSignIn } from './system/probes';
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
export {
  createProductSim,
  type ProductProbes,
  type ProductRuntime,
  productExtra,
  type SimActor,
} from './system/sim';
export { onScreen, tabsVisible } from './system/ui-reads';
