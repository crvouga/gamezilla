import { describe, expect, test } from 'bun:test';
import { APP_SUB_CLIENTS } from '@libs/runtime-client/app-sub-clients';
import { APP, APP_SUBS } from '@libs/runtime-shared/app-subs';
import { composeSubClients } from '@libs/sub-client/compose-client';

const DATA_NAMES = [
  'auth',
  'account-privacy',
  'profile',
  'client-config',
  'spaces',
  'friends',
  'notifications',
  'chess',
  'billing',
  'permissions',
  'synthetic-population',
] as const;

const CLIENT_NAMES = [
  'profile',
  'account-privacy',
  'spaces',
  'puzzle-link',
  'personal-chess-stats',
  'friends',
  'notifications',
  'search',
  'billing',
  'puzzle-management',
  'synthetic-population',
] as const;

const TABLE_NAMES = [
  'auth_account_devices',
  'auth_devices',
  'auth_external_accounts',
  'auth_users',
  'billing_account_closures',
  'billing_payment_evidence',
  'billing_subscriptions',
  'chess_multiplayer_commands',
  'chess_multiplayer_games',
  'chess_multiplayer_players',
  'chess_multiplayer_ratings',
  'chess_opponent_searches',
  'chess_puzzle_feed_settings',
  'chess_puzzle_interactions',
  'chess_puzzle_load',
  'chess_puzzle_profiles',
  'chess_puzzle_rating_events',
  'chess_puzzles',
  'client_config',
  'friends_blocks',
  'friends_friendships',
  'friends_requests',
  'notifications',
  'permissions_quota_ledger',
  'population_commands',
  'population_config',
  'population_events',
  'population_sign_in_mail',
  'population_users',
  'population_workers',
  'profile',
  'profile_account_privacy',
  'profile_deletion_receipts',
  'profile_legal_preservations',
  'spaces',
  'spaces_open_sessions',
  'spaces_users',
] as const;

const QUERY_NAMES = [
  'chessMultiplayerSession',
  'chessMultiplayerSpace',
  'chessPuzzleById',
  'chessPuzzleFeedSettings',
  'chessPuzzleInteractions',
  'chessPuzzleNearest',
  'chessPuzzlePool',
  'chessPuzzleProfile',
  'chessPuzzleRatingEvents',
  'clientConfig',
  'deletionReceipts',
  'downloadPersonalDataExport',
  'friendRequests',
  'friendships',
  'mySpaceUsers',
  'mySpaces',
  'mySubscription',
  'notificationsActive',
  'openSpaceSessions',
  'ownAccountDevices',
  'ownAccountPrivacy',
  'ownDevices',
  'ownExternalAccounts',
  'ownProfile',
  'ownUser',
  'permissionQuotaLedger',
  'profilesByIds',
  'searchProfiles',
  'spaceByLink',
  'userBlocks',
] as const;

const MUTATION_NAMES = [
  'abortMultiplayer',
  'acceptFriendRequest',
  'acceptMultiplayerDraw',
  'acceptMultiplayerRematch',
  'addSpaceUser',
  'appendPuzzleInteraction',
  'applyEnsuredUsername',
  'blockUser',
  'cancelFriendRequest',
  'claimUsername',
  'closeEndedOpenSessions',
  'confirmAccountDeletion',
  'consumeQuota',
  'createSpace',
  'declineFriendRequest',
  'declineMultiplayerDraw',
  'declineMultiplayerRematch',
  'endSpace',
  'ensureDevice',
  'ensureProfile',
  'findChessOpponent',
  'findNewChessOpponent',
  'joinSpace',
  'leaveSpace',
  'markSpaceJoinAnnounced',
  'offerMultiplayerDraw',
  'offerMultiplayerRematch',
  'patchAvatar',
  'playMultiplayerMove',
  'ratePuzzleAttempt',
  'removeFriend',
  'removeSpaceUser',
  'renameSpace',
  'requestPersonalDataExport',
  'resignMultiplayer',
  'savePuzzleFeedSettings',
  'sendFriendRequest',
  'settleMultiplayerClock',
  'stopFindingChessOpponent',
  'unblockUser',
] as const;

function expectDepthOne(
  nodes: readonly { readonly subs?: readonly unknown[] | undefined }[]
): void {
  for (const node of nodes) expect(node.subs ?? []).toEqual([]);
}

describe('shipped subs', () => {
  test('the data fold is the flat sibling list in shipped order', () => {
    expect(APP_SUBS.map((sub) => sub.name)).toEqual([...DATA_NAMES]);
    expect(APP.subNames).toEqual([...DATA_NAMES]);
    expect(APP.subNames).not.toContain('search');
    expectDepthOne(APP_SUBS);
  });

  test('the data fold still yields the shipped tables, queries, and mutations', async () => {
    expect(APP.tableNames).toEqual([...TABLE_NAMES]);
    expect(Object.keys(APP.queries).sort()).toEqual([...QUERY_NAMES]);
    expect(Object.keys(await APP.mutations()).sort()).toEqual([
      ...MUTATION_NAMES,
    ]);
  });

  test('the client list is flat, and search sits between notifications and billing', () => {
    expect(APP_SUB_CLIENTS.map((sub) => sub.name)).toEqual([...CLIENT_NAMES]);
    expect(composeSubClients(APP_SUB_CLIENTS).subNames).toEqual([
      ...CLIENT_NAMES,
    ]);
    expectDepthOne(APP_SUB_CLIENTS);
    const names = [...CLIENT_NAMES];
    expect(names.indexOf('search')).toBe(names.indexOf('notifications') + 1);
    expect(names.indexOf('billing')).toBe(names.indexOf('search') + 1);
  });
});
