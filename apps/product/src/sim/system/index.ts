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
export {
  acceptFriendRequest,
  addFriend,
  blockFriend,
  cancelFriendRequest,
  createSpace,
  declineFriendRequest,
  endSpace,
  focusActor,
  joinFromPrompt,
  leaveAvatarEditor,
  leaveSpace,
  openAvatarEditor,
  openFriendsList,
  openLobbyCard,
  openProfileEdit,
  openPuzzleFromSpace,
  openSettings,
  openSpaceMembers,
  openSpacesTab,
  playUntilSolved,
  pressPuzzleNext,
  reenterActiveSpace,
  removeFriend,
  returnToLobby,
  returnToTabs,
  saveAvatar,
  searchUsername,
  selectChessGame,
  setAvatarSeed,
  setAvatarStyle,
  setUsername,
  signInWithGoogle,
  signOut,
  unblockFriend,
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
  chessGameMenuVisible,
  friendRowVisible,
  lobbyCardVisible,
  readAvatarSeed,
  readAvatarStyleLabel,
  readUsername,
  spaceMemberVisible,
  spacePresenceCount,
  tabsVisible,
} from './ui-reads';
