import { expect } from 'bun:test';
import { finishPuzzleBy } from '@libs/chess-puzzle-harness/chess-actions';
import {
  puzzleExitOffered,
  samePuzzlePlayable,
} from '@libs/chess-puzzle-harness/puzzle-continuity-reads';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { readRecoveryStats } from '@libs/chess-puzzle-harness/puzzle-recovery-stats';
import { returnToTabs, signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection } from '@libs/harness/platform';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  currentPuzzle,
  ensureStatsOpen,
  enterNamedPuzzle,
  trackPuzzle,
} from './puzzle-world';

async function offlineResult(
  w: HarnessWorld,
  actor: Actor,
  finish: 'clean' | 'wrongRetrySolve'
): Promise<void> {
  await w.s.apply(signInWithGoogle, actor);
  await w.s.apply(returnToTabs, actor);
  await enterNamedPuzzle(w, actor, NAMED_PUZZLES.fourMoveMateInTwo);
  await cutConnection(w, actor);
  await w.s.apply(finishPuzzleBy, actor, finish);
  w.memo.set(`recoveryResult:${actor}`, finish);
}

Given(
  "{actor}'s current puzzle is already on their device",
  async (w, actor: Actor) => {
    const puzzle = await trackPuzzle(w, actor);
    expect(await w.s.read(samePuzzlePlayable, actor, puzzle)).toBe(true);
  }
);

Then('{actor} can continue the same puzzle', async (w, actor: Actor) => {
  await w.s.until(
    (s) => samePuzzlePlayable(s, actor, currentPuzzle(w, actor)),
    { pred: Boolean }
  );
});

Given('{actor} has solved a rated puzzle while offline', (w, actor: Actor) =>
  offlineResult(w, actor, 'clean')
);

Given(
  '{actor} has played a wrong move and then solved the same puzzle while offline',
  (w, actor: Actor) => offlineResult(w, actor, 'wrongRetrySolve')
);

async function resultShown(w: HarnessWorld, actor: Actor) {
  await ensureStatsOpen(w, actor);
  return w.s.read(readRecoveryStats, actor, currentPuzzle(w, actor));
}

Then(
  "{actor}'s game log contains that solved puzzle exactly once",
  async (w, actor: Actor) => {
    expect((await resultShown(w, actor)).gameLog).toBe('solved');
  }
);

Then(
  "{actor}'s game log keeps the failed first result exactly once",
  async (w, actor: Actor) => {
    expect((await resultShown(w, actor)).gameLog).toBe('failed');
  }
);

Then(
  "{actor}'s puzzle rating counts that first result exactly once",
  async (w, actor: Actor) => {
    const expected = w.memo.get(`recoveryResult:${actor}`);
    expect((await resultShown(w, actor)).ratedResult).toBe(
      expected === 'clean' ? 'CleanSolve' : 'WrongMove'
    );
  }
);

Then(
  "{actor} can return to the space's game choice",
  async (w, actor: Actor) => {
    expect(await w.s.read(puzzleExitOffered, actor)).toBe(true);
  }
);
