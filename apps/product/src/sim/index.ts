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
export {
  partition,
  resetActor,
  restoreNetwork,
  spawnActor,
  type UiOp,
  uiOp,
} from './system/actions';
export {
  BILLING_OBSERVE_KINDS,
  type BillingObserveKind,
} from './system/billing-actions';
export {
  billingButtonVisible,
  billingTier,
  type MembershipRowView,
  membershipRow,
  membershipRows,
  serverMembershipRow,
} from './system/billing-reads';
export {
  ingestChessPuzzleCsv,
  readLocalPuzzles,
  readPuzzleBoardOrientation,
  readServerPuzzles,
  type StoredPuzzleRow,
} from './system/chess-puzzle-data';
export {
  readFeedHistoryLabel,
  readFeedModalPool,
  readFeedModalTargetRating,
  readFeedOffsetValue,
  readFeedTargetLabel,
  waitFeedTargetRating,
} from './system/chess-puzzle-feed-ui';
export {
  isEmptyPoolVisible,
  isGameLogEmpty,
  isPuzzleLimitVisible,
  isPuzzleSolved,
  pickWrongUci,
  readActivePuzzleId,
  readGameLogRowTitle,
  readPuzzleDebug,
  readPuzzleDisplayFen,
  readPuzzleHintStage,
  readPuzzlePickState,
  readPuzzleSpectator,
  readPuzzleStatus,
  readPuzzleStatusKind,
  readStatsElo,
} from './system/chess-puzzle-ui';
export {
  accountIdOf,
  actorEmail,
  actorLocalSql,
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
export { PRODUCT_POOL_ACTIONS } from './system/pool-actions';
export { captureSnapshot, googleOauthSignIn } from './system/probes';
export {
  acceptFriendRequest,
  addFriend,
  advanceBillingClock,
  blockFriend,
  bumpPuzzleFeedCustomRating,
  bumpPuzzleFeedOffset,
  cancelFriendRequest,
  cancelPlus,
  checkoutPlusAtProvider,
  closePuzzleFeedSettings,
  createSpace,
  declineFriendRequest,
  endSpace,
  focusActor,
  includePlayedPuzzles,
  joinFromPrompt,
  leaveAvatarEditor,
  leavePuzzleToChessMenu,
  leaveSpace,
  managePlus,
  observeMembership,
  openAvatarEditor,
  openBilling,
  openChessStatsScreen,
  openFriendsList,
  openLobbyCard,
  openProfileEdit,
  openPuzzleFeedSettings,
  openPuzzleFromSpace,
  openPuzzleReview,
  openSettings,
  openSpaceMembers,
  openSpacesTab,
  playUntilSolved,
  playWrongPuzzleMove,
  pressPuzzleNext,
  pressPuzzleNextNoWait,
  reenterActiveSpace,
  removeFriend,
  requestPuzzleHint,
  resumePlus,
  retryPuzzle,
  returnToLobby,
  returnToTabs,
  revealPuzzleSolution,
  saveAvatar,
  searchUsername,
  selectChessGame,
  setAvatarSeed,
  setAvatarStyle,
  setPuzzleFeedHistory,
  setPuzzleFeedMode,
  setPuzzleFeedTheme,
  setUsername,
  signInWithGoogle,
  signOut,
  skipPuzzle,
  subscribeToPlus,
  suggestPuzzleMove,
  switchPlusInterval,
  unblockFriend,
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
  chessGameMenuVisible,
  friendRowVisible,
  lobbyCardVisible,
  readAvatarSeed,
  readAvatarStyleLabel,
  readUsername,
  recentSpaceCardVisible,
  spaceMemberVisible,
  spacePresenceCount,
  tabsVisible,
} from './system/ui-reads';
