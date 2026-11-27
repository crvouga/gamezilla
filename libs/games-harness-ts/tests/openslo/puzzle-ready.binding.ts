/**
 * `specs/games/puzzle-ready.openslo.yaml`: in every game offering puzzles,
 * a solver who moves on from a puzzle that is over, again and again,
 * measured on the solver's device from pressing Next until the next puzzle is on
 * the board ready to solve.
 */

import { join } from 'node:path';
import { PUZZLE_READINESS_PROBE } from '@libs/game-puzzle-client-ts/puzzle-readiness-timing';
import {
  isNonEmptyString,
  isNonNegativeInteger,
  isNullOrNonNegativeInteger,
} from '@libs/game-puzzle-shared-ts/play-attr';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  moveOnWithoutWaiting,
  openGamePuzzles,
  readPuzzleOnBoard,
  skipGamePuzzle,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { nodeText } from '@libs/harness-ts/observations';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { isPlainRecord } from '@pkgs/message-shared-ts/message';
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

/** The latest reading for this press. A missing or different board cannot pass. */
async function readTransition(s: OpenHarness, from: string) {
  const text = await s.read(nodeText, SOLVER, [PUZZLE_READINESS_PROBE]);
  if (!text) return null;
  const raw: unknown = JSON.parse(text);
  if (raw === null) return null;
  if (!isPlainRecord(raw)) throw new Error(`Invalid puzzle timing: ${text}`);
  const { from: previous, to, shownMs, readyMs } = raw;
  if (previous !== from || to === from) return null;
  if (
    !isNonEmptyString(to) ||
    !isNonNegativeInteger(shownMs) ||
    !isNullOrNonNegativeInteger(readyMs) ||
    (readyMs !== null && readyMs < shownMs)
  )
    throw new Error(`Invalid puzzle timing: ${text}`);
  return { to, shownMs, readyMs };
}

async function measureTransition(s: OpenHarness) {
  await s.apply(skipGamePuzzle, SOLVER);
  const from = await s.read(readPuzzleOnBoard, SOLVER);
  if (from === null)
    throw new Error('The finished puzzle has no board identity');
  const now = () => s.read((world) => world.harness.clock.now());
  const atMs = await now();
  await s.apply(moveOnWithoutWaiting, SOLVER);
  // Bound host polling. Only the device timestamps decide the SLO.
  const deadline = (await now()) + GIVE_UP_MS;
  for (;;) {
    const reading = await readTransition(s, from);
    if (reading && reading.readyMs !== null) return { atMs, from, ...reading };
    if ((await now()) >= deadline)
      return {
        atMs,
        from,
        to: reading?.to ?? null,
        shownMs: reading?.shownMs ?? null,
        readyMs: null,
      };
    await s.advanceTime(STEP_MS);
  }
}

/** How long each next puzzle of `game` took to be ready, in seconds. */
async function nextPuzzleReadyTimes(
  game: TurnHarnessGame,
  endMs: number
): Promise<readonly Sample[]> {
  await using s = await openConformanceHarness();
  await s.apply(signInWithGoogle, SOLVER);
  await s.apply(createSpace, SOLVER);
  await s.apply(openGamePuzzles, SOLVER, game.shared.id);
  const transitions: Awaited<ReturnType<typeof measureTransition>>[] = [];
  try {
    for (let index = 0; index < MOVES_ON; index += 1)
      transitions.push(await measureTransition(s));
  } finally {
    const reportDir = process.env['HARNESS_REPORT_DIR'];
    if (reportDir)
      await Bun.write(
        join(reportDir, `puzzle-ready-${game.shared.id}.json`),
        JSON.stringify(transitions, null, 2)
      );
  }
  const endedAtMs = await s.read((world) => world.harness.clock.now());
  return transitions.map(({ atMs, readyMs }) => ({
    atMs: endMs - (endedAtMs - atMs),
    value: (readyMs ?? GIVE_UP_MS) / 1000,
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
