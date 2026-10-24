import { describe, expect, test } from 'bun:test';
import { APP_SUB_CLIENTS } from '@libs/runtime-client-ts/app-sub-clients';
import { APP, APP_SUBS } from '@libs/runtime-shared-ts/app-subs';
import { composeSubClients } from '@libs/sub-client-ts/compose-client';

const DATA_NAMES = [
  'auth',
  'account-privacy',
  'profile',
  'client-config',
  'spaces',
  'friends',
  'notifications',
  'game-puzzle',
  'chess',
  'game-session',
  'billing',
  'permissions',
  'synthetic-population',
] as const;

const CLIENT_NAMES = [
  'profile',
  'account-privacy',
  'spaces',
  'puzzle-link',
  'multiplayer-link',
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
  'chess_multiplayer_setups',
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
  'puzzle_content_attempts',
  'puzzle_content_completions',
  'puzzle_content_documents',
  'puzzle_content_drafts',
  'puzzle_content_pack_items',
  'puzzle_content_positions',
  'puzzle_content_publications',
  'puzzle_content_revisions',
  'spaces',
  'spaces_open_sessions',
  'spaces_users',
] as const;

const QUERY_NAMES = [
  'chessMultiplayerSession',
  'chessMultiplayerSpace',
  'chessPuzzleById',
  'chessPuzzleFeedSettings',
  'chessPuzzleImport',
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
  'puzzleContentAttemptsOwned',
  'puzzleContentCompletionsOwned',
  'puzzleContentDocumentsById',
  'puzzleContentDraftCopies',
  'puzzleContentEditions',
  'puzzleContentOwned',
  'puzzleContentPackItems',
  'puzzleContentPositionsOwned',
  'puzzleContentPublished',
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
  'changePuzzleAttempt',
  'chooseMultiplayerSetup',
  'choosePuzzleContentDraft',
  'choosePuzzleContinuation',
  'claimUsername',
  'closeEndedOpenSessions',
  'confirmAccountDeletion',
  'consumeQuota',
  'createPuzzleContent',
  'createPuzzleFromPack',
  'createSpace',
  'declineFriendRequest',
  'declineMultiplayerDraw',
  'declineMultiplayerRematch',
  'dismissMultiplayerResultNotice',
  'editPuzzlePack',
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
  'publishPuzzleContent',
  'ratePuzzleAttempt',
  'removeFriend',
  'removeSpaceUser',
  'renameSpace',
  'requestPersonalDataExport',
  'resignMultiplayer',
  'restartPuzzleAttempt',
  'savePuzzleContentDraft',
  'savePuzzleFeedSettings',
  'sendFriendRequest',
  'settleMultiplayerClock',
  'startPuzzleAttempt',
  'startPuzzleImport',
  'startPuzzlePlaytest',
  'stopFindingChessOpponent',
  'stopPuzzleImport',
  'unblockUser',
  'validatePuzzleContentDraft',
  'withdrawPuzzleContent',
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
    // regression: puzzle-publication-table-unlisted-in-shipped-contract
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
