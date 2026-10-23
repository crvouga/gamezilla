import { seedChessPuzzlesForHarness } from '@libs/chess-puzzle-harness-ts/chess-harness-seed';
import {
  HARNESS_CHESS_FEED_POOL_KEY,
  seedHarnessChessPuzzles,
} from '@libs/chess-puzzle-harness-ts/seed-harness-chess-puzzles';
import { CHESS_HARNESS_GAME } from '@libs/chess-root-harness-ts/chess-harness-game';
import { CHESS_HARNESS_SLICE } from '@libs/chess-root-harness-ts/chess-harness-slice';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import type { OpenHarnessOptions } from '@libs/harness-ts/mode';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { openHarness as openSystemHarness } from '@libs/harness-ts/open-harness';

/**
 * Chess's own suites: chess as the only game, with its puzzles, the people
 * and friends who watch them, and the shared custom-game and opponent
 * sessions every game has.
 */
const CHESS_SYSTEM = gameSystem('chess', [CHESS_HARNESS_GAME]);

/**
 * The world the chess scenarios run in: the same system, with a feed-sized
 * pool of puzzles on the server as well as the three documented ones, the
 * way a real catalog gives a device far more puzzles than a day's play (a
 * scenario that needs just the three retires the rest first).
 */
const CHESS_SPEC_SYSTEM = gameSystem('chess', [CHESS_HARNESS_GAME], {
  slices: [
    {
      ...CHESS_HARNESS_SLICE,
      seedServer: async (sqlClient) => {
        await seedChessPuzzlesForHarness(sqlClient);
        await seedHarnessChessPuzzles({
          sqlClient,
          loadFileKey: HARNESS_CHESS_FEED_POOL_KEY,
        });
      },
    },
  ],
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
  return openGameHarness(CHESS_SPEC_SYSTEM, testId, options);
}
