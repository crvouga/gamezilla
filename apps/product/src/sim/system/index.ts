/**
 * Product system. Hosts are registered runtimes (`in-process`, `bun-webview`).
 * Consumers call `product.run({ seed, runtime })`.
 */

export {
  partition,
  resetActor,
  restoreNetwork,
  spawnActor,
  type UiOp,
  uiOp,
} from './actions';
export { isPuzzleSolved, readActivePuzzleId } from './chess-puzzle-ui';
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
export { PRODUCT_POOL_ACTIONS } from './pool-actions';
export { captureSnapshot, devOauthSignIn } from './probes';
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
} from './scenario-actions';
export {
  createProductSim,
  type ProductProbes,
  type ProductRuntime,
  productExtra,
  type SimActor,
} from './sim';
export {
  globalActionMenuAlwaysVisible,
  nextPuzzleDifferent,
  noErrorBoundaryAnyActor,
  type ProductSim,
  product,
  searchDoesNotHang,
} from './system';
export {
  activeSpaceVisible,
  avatarTraitVisible,
  friendRowVisible,
  lobbyCardVisible,
  readAvatarSeed,
  readAvatarStyleLabel,
  readUsername,
  tabsVisible,
} from './ui-reads';
