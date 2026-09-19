// goal:chess-puzzles:3
// goal:chess-puzzles:4
import { describe, expect, test } from 'bun:test';
import {
  bumpPuzzleFeedCustomRating,
  bumpPuzzleFeedOffset,
  closePuzzleFeedSettings,
  createSpace,
  openPuzzleFeedSettings,
  openPuzzleFromSpace,
  readActivePuzzleId,
  readFeedHistoryLabel,
  readFeedModalPool,
  readFeedModalTargetRating,
  readFeedOffsetValue,
  readFeedTargetLabel,
  readPuzzleDebug,
  returnToTabs,
  setPuzzleFeedHistory,
  setPuzzleFeedMode,
  signInWithGoogle,
} from '../src/sim';
import type { OpenSim } from '../src/test/setup/open-sim';
import { openSim } from '../src/test/setup/open-sim';

/** Default auto target with no rated games (feed config default + profile 1200). */
const DEFAULT_TARGET = 1200;
/** Offset stepper step (see `PUZZLE_FEED_AUTO_OFFSET_STEP`). */
const OFFSET_STEP = 50;

type Sim = OpenSim;
/** Narrow a nullable read result; failing loudly beats a silent `!`. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

async function untilFeedTarget(s: Sim, rating: number): Promise<void> {
  await s.until(
    async (surf) =>
      (await readFeedTargetLabel(surf, 'alice'))?.rating === rating
  );
}

async function enterPuzzle(s: Sim) {
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
}

describe('chess puzzle feed settings', () => {
  test('history filter edit is reflected everywhere after Done', async () => {
    await using s = await openSim('chess-puzzle-feed-history');
    await enterPuzzle(s);
    expect(await s.read(readFeedHistoryLabel, 'alice')).toBe('Unseen');

    await s.apply(openPuzzleFeedSettings, 'alice');
    await s.apply(setPuzzleFeedHistory, 'alice', 'any');
    await s.apply(closePuzzleFeedSettings, 'alice');

    // The feed bar (a different component instance) sees the same config.
    expect(await s.read(readFeedHistoryLabel, 'alice')).toBe('Any');
    // Re-pick after the edit still lands on a real puzzle.
    expect(await s.read(readActivePuzzleId, 'alice')).not.toBeNull();
  });

  test('rating offset moves the target shown in the modal and the feed bar', async () => {
    await using s = await openSim('chess-puzzle-feed-offset');
    await enterPuzzle(s);
    const before = await s.read(readFeedTargetLabel, 'alice');
    expect(before).toEqual({ mode: 'auto', rating: DEFAULT_TARGET });

    await s.apply(openPuzzleFeedSettings, 'alice');
    expect(await s.read(readFeedOffsetValue, 'alice')).toBe(0);
    await s.apply(bumpPuzzleFeedOffset, 'alice', 2);
    expect(await s.read(readFeedOffsetValue, 'alice')).toBe(2 * OFFSET_STEP);
    // Modal caption tracks the live config before Done is pressed.
    expect(await s.read(readFeedModalTargetRating, 'alice')).toBe(
      DEFAULT_TARGET + 2 * OFFSET_STEP
    );
    await s.apply(closePuzzleFeedSettings, 'alice');

    await untilFeedTarget(s, DEFAULT_TARGET + 2 * OFFSET_STEP);
    expect(await s.read(readActivePuzzleId, 'alice')).not.toBeNull();
  });

  test('custom mode swaps the target source and survives reopen', async () => {
    await using s = await openSim('chess-puzzle-feed-custom');
    await enterPuzzle(s);

    await s.apply(openPuzzleFeedSettings, 'alice');
    await s.apply(setPuzzleFeedMode, 'alice', 'custom');
    await s.apply(bumpPuzzleFeedCustomRating, 'alice', 1);
    await s.apply(closePuzzleFeedSettings, 'alice');
    await untilFeedTarget(s, DEFAULT_TARGET + 50);
    expect(await s.read(readFeedTargetLabel, 'alice')).toEqual({
      mode: 'custom',
      rating: DEFAULT_TARGET + 50,
    });

    // Reopening shows the persisted edit and a matching pool summary.
    await s.apply(openPuzzleFeedSettings, 'alice');
    const pool = required(await s.read(readFeedModalPool, 'alice'), 'pool');
    expect(pool.total).toBeGreaterThan(0);
    await s.apply(closePuzzleFeedSettings, 'alice');
  });
  test('custom difficulty target changes the selected puzzle band', async () => {
    await using s = await openSim('chess-puzzle-feed-difficulty-band');
    await enterPuzzle(s);
    const before = await s.read(readActivePuzzleId, 'alice');

    await s.apply(openPuzzleFeedSettings, 'alice');
    await s.apply(setPuzzleFeedMode, 'alice', 'custom');
    await s.apply(bumpPuzzleFeedCustomRating, 'alice', 2);
    await s.apply(closePuzzleFeedSettings, 'alice');

    expect(await s.read(readFeedTargetLabel, 'alice')).toEqual({
      mode: 'custom',
      rating: DEFAULT_TARGET + 100,
    });
    const debug = await s.read(readPuzzleDebug, 'alice');
    expect(debug?.status).toBe('solving');
    expect(debug?.puzzleRating).not.toBeNull();
    expect(debug?.puzzleRating).toBeGreaterThanOrEqual(1200);
    expect(debug?.puzzleRating).toBeLessThanOrEqual(1400);
    expect(await s.read(readActivePuzzleId, 'alice')).not.toBe(before);
  });
});
