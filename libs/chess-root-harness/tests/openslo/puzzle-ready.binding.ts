/**
 * `specs/chess/puzzle-ready.openslo.yaml`: a solver who moves on from a
 * puzzle that is over, again and again, measured on the harness clock from
 * pressing "Next puzzle" until the next puzzle is on the board ready to
 * solve.
 */

import {
  openPuzzleFromSpace,
  pressPuzzleNextNoWait,
  skipPuzzle,
} from '@libs/chess-puzzle-harness/chess-actions';
import { readPuzzleBoardProbe } from '@libs/chess-puzzle-harness/chess-puzzle-solve-ui';
import { readActivePuzzleId } from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { createSpace } from '@libs/spaces-harness/space-actions';
import type { Measurement } from '@pkgs/openslo-shared/evaluate';
import type { MeasureContext } from '@pkgs/openslo-shared/registry';
import { bindObjectives } from '@pkgs/openslo-shared/registry';
import { openHarness } from '../open-chess-harness';

const SOLVER = 'alice';
/** Times the solver moves on. */
const MOVES_ON = 20;
/** Past this the next puzzle never came; the sample records the wait. */
const GIVE_UP_MS = 10_000;
const STEP_MS = 5;

async function nextPuzzleReadyTimes(
  context: MeasureContext
): Promise<Measurement> {
  await using s = await openHarness('puzzle-ready-objective');
  await s.apply(signInWithGoogle, SOLVER);
  await s.apply(createSpace, SOLVER);
  await s.apply(openPuzzleFromSpace, SOLVER);
  const now = () => s.read((world) => world.harness.clock.now());
  const samples: { atMs: number; value: number }[] = [];
  for (let index = 0; index < MOVES_ON; index += 1) {
    await s.apply(skipPuzzle, SOLVER);
    const over = await s.read(readActivePuzzleId, SOLVER);
    const movedOnAtMs = await now();
    await s.apply(pressPuzzleNextNoWait, SOLVER);
    let waited = 0;
    for (;;) {
      waited = (await now()) - movedOnAtMs;
      const id = await s.read(readActivePuzzleId, SOLVER);
      const board = await s.read(readPuzzleBoardProbe, SOLVER);
      if (id !== null && id !== over && board?.interactive === true) break;
      if (waited >= GIVE_UP_MS) break;
      await s.advanceTime(STEP_MS);
    }
    samples.push({ atMs: movedOnAtMs, value: waited / 1000 });
  }
  const endedAtMs = await now();
  return {
    kind: 'samples',
    samples: samples.map((sample) => ({
      atMs: context.endMs - (endedAtMs - sample.atMs),
      value: sample.value,
    })),
  };
}

bindObjectives({
  spec: 'puzzle-ready',
  measure: { 'next-puzzle-ready-time': nextPuzzleReadyTimes },
  nowMs: () => Date.UTC(2026, 9, 5, 12),
});
