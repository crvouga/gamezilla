import { type AppPolicyKey, PERMISSION } from './permission-catalog';

/**
 * What a server-side mutation requires (§22.6):
 * - an action / permission key: the replay is authorized by `decide` first;
 * - `'quota'`: the mutation body consumes a quota itself (`consumeQuota`);
 * - `'public'`: no permission gate (identity/ownership checks live in the
 *   body, e.g. per-space presence roles).
 */
export type MutationActionDeclaration = AppPolicyKey | 'public' | 'quota';

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
  // chess
  appendPuzzleInteraction: PERMISSION.puzzlesPlay,
  ratePuzzleAttempt: PERMISSION.puzzlesPlay,
  // spaces (host / member checks run in the bodies against space roles)
  createSpace: PERMISSION.spacesCreate,
  joinSpace: PERMISSION.spacesJoin,
  leaveSpace: 'public',
  endSpace: 'public',
  renameSpace: 'public',
  setVisibility: 'public',
  addSpaceUser: 'public',
  removeSpaceUser: 'public',
  markSpaceJoinAnnounced: 'public',
  // friends
  sendFriendRequest: 'public',
  acceptFriendRequest: 'public',
  declineFriendRequest: 'public',
  cancelFriendRequest: 'public',
  removeFriend: 'public',
  blockUser: 'public',
  unblockUser: 'public',
  // permissions
  consumeQuota: 'quota',
};
