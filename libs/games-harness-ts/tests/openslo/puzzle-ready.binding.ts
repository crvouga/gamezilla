/**
 * `specs/games/puzzle-ready.openslo.yaml`: in every game offering puzzles,
 * a solver who moves on from a puzzle that is over, again and again,
 * measured on the harness clock from moving on until the next puzzle is on
 * the board ready to solve.
 */

import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  moveOnWithoutWaiting,
  openGamePuzzles,
  readPuzzleOnBoard,
  readPuzzleProbe,
  skipGamePuzzle,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import type { MeasureContext } from '@pkgs/openslo-shared-ts/registry';
import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { openConformanceHarness, turnGamesHeldTo } from '../conformance-world';

const SOLVER = 'alice';
/** Times the solver moves on, in each game. */
const MOVES_ON = 20;
/** Past this the next puzzle never came; the sample records the wait. */
const GIVE_UP_MS = 10_000;
const STEP_MS = 5;

type Sample = { readonly atMs: number; readonly value: number };

/** How long each next puzzle of `game` took to be ready, in seconds. */
async function nextPuzzleReadyTimes(
  game: TurnHarnessGame,
  endMs: number
): Promise<readonly Sample[]> {
  await using s = await openConformanceHarness(
    `puzzle-ready-objective-${game.shared.id}`
  );
  await s.apply(signInWithGoogle, SOLVER);
  await s.apply(createSpace, SOLVER);
  await s.apply(openGamePuzzles, SOLVER, game.shared.id);
  const now = () => s.read((world) => world.harness.clock.now());
  const samples: Sample[] = [];
  for (let index = 0; index < MOVES_ON; index += 1) {
    await s.apply(skipGamePuzzle, SOLVER);
    const over = await s.read(readPuzzleOnBoard, SOLVER);
    const movedOnAtMs = await now();
    await s.apply(moveOnWithoutWaiting, SOLVER);
    let waited = 0;
    for (;;) {
      waited = (await now()) - movedOnAtMs;
      const id = await s.read(readPuzzleOnBoard, SOLVER);
      const probe = await s.read(readPuzzleProbe, SOLVER);
      if (id !== null && id !== over && probe?.interactive === true) break;
      if (waited >= GIVE_UP_MS) break;
      await s.advanceTime(STEP_MS);
    }
    samples.push({ atMs: movedOnAtMs, value: waited / 1000 });
  }
  const endedAtMs = await now();
  return samples.map((sample) => ({
    atMs: endMs - (endedAtMs - sample.atMs),
    value: sample.value,
  }));
}

async function readyTimes(context: MeasureContext) {
  const samples: Sample[] = [];
  for (const game of turnGamesHeldTo('specs/games/puzzle-ready.openslo.yaml'))
    samples.push(...(await nextPuzzleReadyTimes(game, context.endMs)));
  return { kind: 'samples' as const, samples };
}

bindObjectives({
  spec: 'puzzle-ready',
  measure: { 'next-puzzle-ready-time': readyTimes },
  nowMs: () => Date.UTC(2026, 9, 5, 12),
});
