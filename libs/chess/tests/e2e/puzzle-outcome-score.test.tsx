/**
 * The score each way of finishing a puzzle offline is rated with, on the
 * device and after the offline attempt reaches the server, and that a second
 * reconnect replays nothing. The scores are GOAL decisions (a clean solve 1,
 * a hint or a wrong move 0.5, the solution or a skip 0); the Gherkin keeps
 * only what a person sees (the game log and the stats).
 */

import { describe, expect, test } from 'bun:test';
import {
  openPuzzleFromSpace,
  playUntilSolved,
  playWrongPuzzleMove,
  requestPuzzleHint,
  retryPuzzle,
  showPuzzleSolutionLine,
  skipPuzzle,
} from '@libs/chess/sim/chess-actions';
import {
  countLocalWrongMoves,
  countServerWrongMoves,
} from '@libs/chess/sim/chess-puzzle-ledger-data';
import { readActivePuzzleId } from '@libs/chess/sim/chess-puzzle-ui';
import {
  type PuzzleRatingEventRow,
  readLocalPuzzleProfile,
  readLocalRatingEvents,
  readServerPuzzleProfile,
  readServerRatingEvents,
} from '@libs/chess/sim/chess-rating-data';
import {
  accountIdOf,
  partition,
  restoreNetwork,
  returnToTabs,
  signInWithGoogle,
} from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { type OpenSim, openSim } from './support/open-chess-sim';

const CASES = [
  { name: 'clean solve', score: 1000, outcome: 'solved' },
  { name: 'hint then solve', score: 500, outcome: 'solved' },
  // regression: puzzle-wrong-move-half-credit
  { name: 'wrong then retry', score: 500, outcome: 'failed' },
  { name: 'show solution', score: 0, outcome: 'failed' },
  { name: 'skip', score: 0, outcome: 'abandoned' },
] as const;

type CaseName = (typeof CASES)[number]['name'];

async function finish(s: OpenSim, name: CaseName): Promise<void> {
  if (name === 'hint then solve') await s.apply(requestPuzzleHint, 'alice');
  if (name === 'wrong then retry') {
    await s.apply(playWrongPuzzleMove, 'alice');
    await s.apply(retryPuzzle, 'alice');
  }
  if (name === 'show solution') {
    await s.apply(showPuzzleSolutionLine, 'alice');
  } else if (name === 'skip') {
    await s.apply(skipPuzzle, 'alice');
  } else {
    await s.apply(playUntilSolved, 'alice');
  }
}

function normalized(events: readonly PuzzleRatingEventRow[]) {
  return events.map((event) => ({
    ...event,
    at: new Date(event.at).toISOString(),
  }));
}

/** Alice signed in, on a puzzle in her space; her id and the puzzle's. */
async function onPuzzle(s: OpenSim) {
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
  const owner = await s.read(accountIdOf, 'alice');
  const puzzle = await s.read(readActivePuzzleId, 'alice');
  if (owner === null || puzzle === null) {
    throw new Error('missing player or puzzle');
  }
  return { owner, puzzle };
}

describe('puzzle outcome scoring survives offline replay', () => {
  for (const entry of CASES) {
    test(`${entry.name} scores ${String(entry.score)}‰ on the device and after reconnect, once`, async () => {
      await using s = await openSim(
        `puzzle-outcome-score-${entry.score}-${entry.outcome}`
      );
      const { owner, puzzle } = await onPuzzle(s);

      await s.apply(partition, 'alice');
      await finish(s, entry.name);
      const local = normalized(
        await s.read(readLocalRatingEvents, 'alice', owner)
      );
      expect(local).toHaveLength(1);
      expect(local[0]).toMatchObject({
        puzzle_id: puzzle,
        outcome: entry.outcome,
        score_permille: entry.score,
      });
      expect(await s.read(readServerRatingEvents, owner)).toEqual([]);
      const profile = await s.read(readLocalPuzzleProfile, 'alice', owner);
      expect(profile).not.toBeNull();

      await s.apply(restoreNetwork);
      await s.until(
        async (surf) =>
          (await readServerRatingEvents(surf, owner)).length === 1,
        { maxMs: 30_000, stepMs: 100 }
      );
      expect(normalized(await s.read(readServerRatingEvents, owner))).toEqual(
        local
      );
      expect(await s.read(readServerPuzzleProfile, owner)).toEqual(profile);

      // A second disconnect and reconnect must not replay the rating.
      await s.apply(partition, 'alice');
      await s.apply(restoreNetwork);
      await s.advanceTime(2_000);
      expect(normalized(await s.read(readServerRatingEvents, owner))).toEqual(
        local
      );
      expect(
        normalized(await s.read(readLocalRatingEvents, 'alice', owner))
      ).toEqual(local);
      expect(await s.read(readLocalPuzzleProfile, 'alice', owner)).toEqual(
        profile
      );
    });
  }

  test('a wrong move made offline reaches the server exactly once', async () => {
    await using s = await openSim('puzzle-outcome-offline-wrong-move');
    const { owner, puzzle } = await onPuzzle(s);

    await s.apply(partition, 'alice');
    await s.apply(playWrongPuzzleMove, 'alice');
    expect(await s.read(countLocalWrongMoves, 'alice', puzzle)).toBe(1);
    expect(await s.read(countServerWrongMoves, owner, puzzle)).toBe(0);

    await s.apply(restoreNetwork);
    await s.until(
      async (surf) => (await countServerWrongMoves(surf, owner, puzzle)) === 1,
      { maxMs: 30_000, stepMs: 100 }
    );
    await s.apply(partition, 'alice');
    await s.apply(restoreNetwork);
    await s.advanceTime(2_000);
    expect(await s.read(countServerWrongMoves, owner, puzzle)).toBe(1);
  });
});
