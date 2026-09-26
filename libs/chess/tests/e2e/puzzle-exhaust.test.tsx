// goal:chess-puzzles:5
import { describe, expect, test } from 'bun:test';
import {
  closePuzzleFeedSettingsNoWait,
  includePlayedPuzzles,
  openPuzzleFeedSettings,
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNext,
  setPuzzleFeedTheme,
} from '@libs/chess/sim/chess-actions';
import { readFeedHistoryLabel } from '@libs/chess/sim/chess-puzzle-feed-ui';
import {
  isEmptyPoolVisible,
  isPuzzleAttemptRated,
  readActivePuzzleId,
  readPuzzlePickSource,
} from '@libs/chess/sim/chess-puzzle-ui';
import { SIM_CHESS_PUZZLES } from '@libs/chess/sim/sim-chess-puzzles';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { openSim } from './support/open-chess-sim';

const WAIT_MS = 15_000;

describe('chess puzzle exhausted feed', () => {
  /**
   * §9: the pool is never a dead end. Once every unseen puzzle is solved the
   * feed comes round to the puzzle attempted longest ago — and that attempt
   * is unrated, because the puzzle already moved the rating once (§8).
   */
  test('after every unseen puzzle is solved, the oldest attempt comes round again, unrated', async () => {
    await using s = await openSim('chess-puzzle-exhaust');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');

    const played: string[] = [];
    for (const _puzzle of SIM_CHESS_PUZZLES) {
      const id = await s.read(readActivePuzzleId, 'alice');
      if (id === null) throw new Error('expected an active puzzle');
      expect(played).not.toContain(id);
      expect(await s.read(isPuzzleAttemptRated, 'alice')).toBe(true);
      played.push(id);
      await s.apply(playUntilSolved, 'alice');
      await s.apply(pressPuzzleNext, 'alice');
    }

    await s.until(
      async (surf) =>
        (await readPuzzlePickSource(surf, 'alice')) === 'exhausted',
      { maxMs: WAIT_MS, stepMs: 250 }
    );
    expect(await s.read(readActivePuzzleId, 'alice')).toBe(played[0] ?? null);
    expect(await s.read(isPuzzleAttemptRated, 'alice')).toBe(false);
    expect(await s.read(isEmptyPoolVisible, 'alice')).toBe(false);
  });

  /**
   * A filter that matches nothing is still a dead end — that is what the
   * empty-pool block is for, and widening recovers from it.
   */
  test('a theme filter that matches nothing shows the empty state; widening recovers', async () => {
    await using s = await openSim('chess-puzzle-exhaust-theme');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');

    await s.apply(openPuzzleFeedSettings, 'alice');
    await s.apply(setPuzzleFeedTheme, 'alice', 'zugzwang');
    await s.apply(closePuzzleFeedSettingsNoWait, 'alice');

    await s.until((surf) => isEmptyPoolVisible(surf, 'alice'), {
      maxMs: WAIT_MS,
      stepMs: 250,
    });
    expect(await s.read(readActivePuzzleId, 'alice')).toBeNull();

    await s.apply(includePlayedPuzzles, 'alice');
    expect(await s.read(readFeedHistoryLabel, 'alice')).toBe('Any');
    expect(await s.read(readActivePuzzleId, 'alice')).not.toBeNull();
    expect(await s.read(isEmptyPoolVisible, 'alice')).toBe(false);
  });
});
