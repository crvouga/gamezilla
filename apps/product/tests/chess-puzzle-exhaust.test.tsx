import { describe, expect, test } from 'bun:test';
import { Handles } from '@libs/test-ids';
import {
  createSpace,
  includePlayedPuzzles,
  isEmptyPoolVisible,
  nodeText,
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNext,
  pressPuzzleNextNoWait,
  readActivePuzzleId,
  readFeedHistoryLabel,
  returnToTabs,
  signInWithDev,
} from '../src/sim';
import { SIM_CHESS_PUZZLES } from '../src/test/fixtures/chess-puzzles';
import { openSim } from '../src/test/setup/open-sim';

describe('chess puzzle exhausted feed', () => {
  test('after every unseen puzzle is solved, Next shows the empty state; widening recovers', async () => {
    await using s = await openSim('chess-puzzle-exhaust');
    await s.apply(signInWithDev, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');

    // Default feed is "Unseen": each solve removes one of the seeded puzzles.
    for (let i = 0; i < SIM_CHESS_PUZZLES.length - 1; i += 1) {
      await s.apply(playUntilSolved, 'alice');
      await s.apply(pressPuzzleNext, 'alice');
    }
    await s.apply(playUntilSolved, 'alice');
    await s.apply(pressPuzzleNextNoWait, 'alice');

    try {
      await s.until((surf) => isEmptyPoolVisible(surf, 'alice'), {
        maxMs: 15_000,
        stepMs: 250,
      });
    } catch (error) {
      const status = await s.read(nodeText, 'alice', [
        Handles.chessPuzzlePickStatus,
      ]);
      throw new Error(
        `empty pool never shown; pick status: ${String(status)}`,
        {
          cause: error,
        }
      );
    }
    expect(await s.read(isEmptyPoolVisible, 'alice')).toBe(true);
    expect(await s.read(readActivePuzzleId, 'alice')).toBeNull();

    await s.apply(includePlayedPuzzles, 'alice');
    expect(await s.read(readFeedHistoryLabel, 'alice')).toBe('Any');
    expect(await s.read(readActivePuzzleId, 'alice')).not.toBeNull();
    expect(await s.read(isEmptyPoolVisible, 'alice')).toBe(false);
  });
});
