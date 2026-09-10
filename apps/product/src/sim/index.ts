/**
 * @apps/product/sim — shared product simulation fabric + System.
 *
 * Console and test couple only to this package's public API (`product.run`,
 * actions, reads). Hosts are registered runtimes: `in-process`, `bun-webview`.
 *
 * Isomorphism: fabric + `in-process` + system/actions must run under web
 * (product-simulator). Node-only seed / HTTP helpers live under `setup/` and
 * `hosts/localhost-http` (`.web.ts` stubs) and are dynamic-imported from tests.
 */

export {
  bumpSimClientEpoch,
  type CreateSimOptions,
  createSim,
  type Server,
  type Sim,
  simClientNamespace,
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
export {
  partition,
  resetActor,
  restoreNetwork,
  spawnActor,
  type UiOp,
  uiOp,
} from './system/actions';
export { isPuzzleSolved, readActivePuzzleId } from './system/chess-puzzle-ui';
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
  acceptFriendRequest,
  addFriend,
  createSpace,
  endSpace,
  focusActor,
  joinFromPrompt,
  leaveAvatarEditor,
  openAvatarEditor,
  openFriendsList,
  openLobbyCard,
  openProfileEdit,
  openPuzzleFromSpace,
  openSettings,
  openSpacesTab,
  playUntilSolved,
  pressPuzzleNext,
  reenterActiveSpace,
  returnToLobby,
  returnToTabs,
  saveAvatar,
  searchUsername,
  setAvatarSeed,
  setAvatarStyle,
  setUsername,
  signInWithDev,
  signOut,
} from './system/scenario-actions';
export {
  createProductSim,
  type ProductProbes,
  type ProductRuntime,
  productExtra,
  type SimActor,
} from './system/sim';
export {
  globalActionMenuAlwaysVisible,
  nextPuzzleDifferent,
  noErrorBoundaryAnyActor,
  type ProductSim,
  product,
  searchDoesNotHang,
} from './system/system';
export {
  activeSpaceVisible,
  avatarTraitVisible,
  friendRowVisible,
  lobbyCardVisible,
  readAvatarSeed,
  readAvatarStyleLabel,
  readUsername,
  tabsVisible,
} from './system/ui-reads';
