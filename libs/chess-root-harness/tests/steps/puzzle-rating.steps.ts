/**
 * The puzzle stats as a chess solver sees them: the played / solved /
 * accuracy figures and the game log. How every game's rating reads on two
 * devices and after offline play is the Games context's.
 */

import {
  readGameLogTitle,
  readStatsFigures,
} from '@libs/game-session-harness/puzzle-records';
import { Then } from '@libs/harness/define';
import type { ProductHarness } from '@libs/harness/harness';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { currentPuzzle, ensureStatsOpen, SETTLE_MS } from './puzzle-world';

type Figures = {
  readonly played: number | null;
  readonly solved: number | null;
  readonly accuracy: number | null;
};

async function readFigures(
  s: ProductHarness,
  device: string
): Promise<Figures> {
  return {
    ...(await readStatsFigures(s, device)),
  };
}

/** The stats on `device` show exactly these figures (they may still sync). */
async function untilFigures(
  w: HarnessWorld,
  device: string,
  expected: Figures,
  maxMs: number
): Promise<void> {
  await ensureStatsOpen(w, device);
  const same = (f: Figures) =>
    f.played === expected.played &&
    f.solved === expected.solved &&
    f.accuracy === expected.accuracy;
  await w.s.until((surf) => readFigures(surf, device), { maxMs, pred: same });
}

// ------------------------------------------------------ stats and game log

Then(
  "{actor}'s stats show {int} played, {int} solved, and {int}% accuracy",
  async (
    w,
    actor: Actor,
    ...[played, solved, accuracy]: [number, number, number]
  ) => {
    await untilFigures(w, actor, { played, solved, accuracy }, SETTLE_MS);
  }
);

/** How the game log titles a puzzle that ended each way. */
const LOG_TITLES: Partial<Record<string, RegExp>> = {
  solved: /^Solved/,
  failed: /^Failed/,
  abandoned: /^Abandoned/,
};

Then(
  "{actor}'s game log records that puzzle as {word}",
  async (w, actor: Actor, outcome: string) => {
    const title = LOG_TITLES[outcome];
    if (title === undefined) {
      throw new Error(`no game log outcome "${outcome}"`);
    }
    await ensureStatsOpen(w, actor);
    await w.s.until(
      (surf) => readGameLogTitle(surf, actor, currentPuzzle(w, actor)),
      { maxMs: SETTLE_MS, pred: (text) => text !== null && title.test(text) }
    );
  }
);
