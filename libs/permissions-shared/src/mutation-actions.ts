import type { AppGrantKey } from './permission-catalog';
import { PERMISSION } from './permission-catalog';

/**
 * What a server-side mutation requires (§22.6):
 * - an action / permission key: the replay is authorized by `decide` first;
 * - `'quota'`: the mutation body consumes a quota itself (`consumeQuota`);
 * - `'public'`: no app-wide gate; the body decides itself through
 *   `requireInMutation` when the action is resource-scoped (per-space
 *   presence roles) or needs no permission (identity bootstrap).
 */
export type MutationActionDeclaration = AppGrantKey | 'public' | 'quota';

/**
 * Every product mutation name → its declaration. The server's authorize hook
 * rejects an undeclared name, and a contract test fails CI when a registered
 * mutation is missing here.
 */
export const MUTATION_ACTIONS: Readonly<
  Record<string, MutationActionDeclaration>
> = {
  // auth
  ensureDevice: 'public',
  closeEndedOpenSessions: 'public',
  // profile
  ensureProfile: 'public',
  applyEnsuredUsername: 'public',
  claimUsername: 'public',
  patchAvatar: 'public',
  confirmAccountDeletion: PERMISSION.profileDeleteAccount,
  requestPersonalDataExport: PERMISSION.profileExportData,
  // chess
  findChessOpponent: PERMISSION.matchmakingUse,
  stopFindingChessOpponent: PERMISSION.matchmakingStop,
  playMultiplayerMove: PERMISSION.chessMultiplayerPlay,
  resignMultiplayer: PERMISSION.chessMultiplayerResign,
  findNewChessOpponent: PERMISSION.matchmakingUse,
  abortMultiplayer: PERMISSION.chessMultiplayerPlay,
  offerMultiplayerDraw: PERMISSION.chessMultiplayerPlay,
  acceptMultiplayerDraw: PERMISSION.chessMultiplayerPlay,
  declineMultiplayerDraw: PERMISSION.chessMultiplayerPlay,
  offerMultiplayerRematch: PERMISSION.chessMultiplayerPlay,
  acceptMultiplayerRematch: PERMISSION.chessMultiplayerPlay,
  declineMultiplayerRematch: PERMISSION.chessMultiplayerPlay,
  settleMultiplayerClock: PERMISSION.chessMultiplayerPlay,
  appendPuzzleInteraction: PERMISSION.puzzlesPlay,
  ratePuzzleAttempt: PERMISSION.puzzlesPlay,
  savePuzzleFeedSettings: PERMISSION.puzzlesCustomizeFeed,
  // spaces (host / member decisions run in the bodies with presence scope)
  createSpace: PERMISSION.spacesCreate,
  joinSpace: PERMISSION.spacesJoin,
  leaveSpace: 'public',
  endSpace: 'public',
  renameSpace: 'public',
  addSpaceUser: 'public',
  removeSpaceUser: 'public',
  markSpaceJoinAnnounced: 'public',
  // friends
  sendFriendRequest: PERMISSION.friendsUse,
  acceptFriendRequest: PERMISSION.friendsUse,
  declineFriendRequest: PERMISSION.friendsUse,
  cancelFriendRequest: PERMISSION.friendsUse,
  removeFriend: PERMISSION.friendsUse,
  blockUser: PERMISSION.friendsUse,
  unblockUser: PERMISSION.friendsUse,
  // permissions
  consumeQuota: 'quota',
};
