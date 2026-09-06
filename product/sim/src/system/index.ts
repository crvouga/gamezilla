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
  acceptFriendRequest,
  addFriend,
  createSpace,
  endSpace,
  expectActiveSpace,
  expectAvatarSeed,
  expectAvatarStyleLabel,
  expectAvatarTraitVisible,
  expectFriend,
  expectLobbyCard,
  expectLobbyCardGone,
  expectPuzzleSolved,
  expectUsername,
  joinFromPrompt,
  leaveAvatarEditor,
  openAvatarEditor,
  openFriendsList,
  openLobbyCard,
  openProfileEdit,
  openPuzzleFromSpace,
  openSpacesTab,
  playUntilSolved,
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
  noErrorBoundaryAnyActor,
  type ProductSim,
  product,
  searchDoesNotHang,
} from './system';
