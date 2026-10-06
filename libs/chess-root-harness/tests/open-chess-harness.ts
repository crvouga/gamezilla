import { ACCOUNT_PRIVACY_HARNESS_SLICE } from '@libs/account-privacy-harness/account-privacy-harness-slice';
import { BILLING_HARNESS_SLICE } from '@libs/billing-harness/billing-harness-slice';
import { customGameBotRoomNode } from '@libs/chess-custom-game-harness/custom-game-bot-choice';
import { chessGameShared } from '@libs/chess-feature-shared/chess-game';
import { seedChessPuzzlesForHarness } from '@libs/chess-puzzle-harness/chess-harness-seed';
import {
  HARNESS_CHESS_FEED_POOL_KEY,
  seedHarnessChessPuzzles,
} from '@libs/chess-puzzle-harness/seed-harness-chess-puzzles';
import { chessGameClient } from '@libs/chess-root-client/chess-game-def';
import { CHESS_HARNESS_SLICE } from '@libs/chess-root-harness/chess-harness-slice';
import { FRIENDS_HARNESS_SLICE } from '@libs/friends-harness/friends-harness-slice';
import { FRIENDS_BLOCK_RELATION } from '@libs/friends-shared/block-relation';
import { defineProductSystem } from '@libs/harness/define-product-system';
import type { OpenHarnessOptions } from '@libs/harness/mode';
import type { OpenHarness } from '@libs/harness/open-harness';
import { openHarness as openSystemHarness } from '@libs/harness/open-harness';
import type { HarnessSlice } from '@libs/harness/slices';
import { composeHarnessSlices } from '@libs/harness/slices';
import { NOTIFICATIONS_HARNESS_SLICE } from '@libs/notifications-harness/notifications-harness-slice';
import { PROFILE_HARNESS_SLICE } from '@libs/profile-harness/profile-harness-slice';
import { SEARCH_HARNESS_SLICE } from '@libs/search-harness/search-harness-slice';
import { spacesHarnessSlice } from '@libs/spaces-harness/spaces-harness-slice';

/**
 * Chess puzzles and what they cross: a puzzle opens in a space hosting only
 * chess, profile owns the signed-in identity, and friends watch a puzzle live
 * — so the befriending path (search finds a person, notifications deliver the
 * request) is in too. Billing is in because permissions reads its
 * `billing_subscriptions` rows directly, and its plans are where the guest
 * puzzle limit sends you.
 */
function chessSystem(chess: HarnessSlice) {
  const spaces = spacesHarnessSlice({
    games: [chessGameShared],
    clients: [chessGameClient],
    blocks: FRIENDS_BLOCK_RELATION,
  });
  if (spaces.roomNode === undefined) throw new Error('Chess needs a room node');
  return defineProductSystem(
    composeHarnessSlices('chess', [
      ACCOUNT_PRIVACY_HARNESS_SLICE,
      PROFILE_HARNESS_SLICE,
      { ...spaces, roomNode: customGameBotRoomNode(spaces.roomNode) },
      FRIENDS_HARNESS_SLICE,
      NOTIFICATIONS_HARNESS_SLICE,
      SEARCH_HARNESS_SLICE,
      chess,
      BILLING_HARNESS_SLICE,
    ])
  );
}

const CHESS_SYSTEM = chessSystem(CHESS_HARNESS_SLICE);

/**
 * The world the chess scenarios run in: the same system, with a feed-sized
 * pool of puzzles on the server as well as the three documented ones, the
 * way a real catalog gives a device far more puzzles than a day's play (a
 * scenario that needs just the three retires the rest first).
 */
const CHESS_SPEC_SYSTEM = chessSystem({
  ...CHESS_HARNESS_SLICE,
  seedServer: async (sqlClient) => {
    await seedChessPuzzlesForHarness(sqlClient);
    await seedHarnessChessPuzzles({
      sqlClient,
      loadFileKey: HARNESS_CHESS_FEED_POOL_KEY,
    });
  },
});

export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openSystemHarness(CHESS_SYSTEM, testId, options);
}

/** {@link openHarness} for the chess scenarios (see {@link CHESS_SPEC_SYSTEM}). */
export function openSpecHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openSystemHarness(CHESS_SPEC_SYSTEM, testId, options);
}
