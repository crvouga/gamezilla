import { expect } from 'bun:test';
import {
  knownPuzzleLinePoint,
  knownPuzzlePreviousPoint,
} from '@libs/game-session-harness-ts/puzzle-line-layout';
import {
  choosePuzzleLineMove,
  readPuzzleBoardPosition,
  readPuzzleProbe,
  stepThroughPuzzleLine,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { Then, When } from '@libs/harness-ts/define';
import type { Actor, PuzzleLinePoint } from '@libs/harness-ts/parameter-types';
import { focusActor } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { gameOf } from './game-world';
import {
  focusPuzzle,
  puzzleOn,
  puzzlePositionBeforeReviewKey,
  SECOND_MS,
  SETTLE_MS,
} from './puzzle-world';

async function expectLinePoint(
  w: HarnessWorld,
  actor: Actor,
  point: PuzzleLinePoint,
  maxMs: number
): Promise<void> {
  await focusPuzzle(w, actor);
  const at = knownPuzzleLinePoint(gameOf(w), puzzleOn(w, actor), point);
  await w.s.until(
    async (surf) => ({
      move: (await readPuzzleProbe(surf, actor))?.solveIdx,
      position: await readPuzzleBoardPosition(surf, actor),
    }),
    {
      maxMs,
      pred: (shown) => shown.move === at.move && shown.position === at.position,
    }
  );
}

Then(
  "{actor}'s board shows {puzzlePosition}",
  async (w, actor: Actor, point: PuzzleLinePoint) => {
    await expectLinePoint(w, actor, point, SETTLE_MS);
  }
);

Then(
  "{actor}'s board shows {puzzlePosition} within {int} seconds",
  async (w, actor: Actor, point: PuzzleLinePoint, seconds: number) => {
    await expectLinePoint(w, actor, point, seconds * SECOND_MS);
  }
);

Then(
  '{actor} is solving the puzzle {puzzleProgress} the first move of the solution',
  async (w, actor: Actor, point: PuzzleLinePoint) => {
    await expectLinePoint(w, actor, point, SETTLE_MS);
    const probe = await w.s.until((surf) => readPuzzleProbe(surf, actor), {
      maxMs: SETTLE_MS,
      pred: (seen) => seen?.status === 'solving' && seen.interactive,
    });
    expect(probe?.status).toBe('solving');
    expect(probe?.interactive).toBe(true);
  }
);

Then(
  '{actor} is reviewing the position one move before the current position',
  async (w, actor: Actor) => {
    await focusPuzzle(w, actor);
    const probe = await w.s.read(readPuzzleProbe, actor);
    if (probe === null) throw new Error(`${actor} has no puzzle on the board`);
    const at = knownPuzzlePreviousPoint(
      gameOf(w),
      puzzleOn(w, actor),
      Number(w.memo.get(puzzlePositionBeforeReviewKey(actor)))
    );
    expect(probe.solveIdx).toBe(at.move);
    expect(await w.s.read(readPuzzleBoardPosition, actor)).toBe(at.position);
  }
);

When(
  '{actor} steps forward one move in the puzzle',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(stepThroughPuzzleLine, actor, 'forward');
  }
);

When(
  "{actor} chooses the first move from the puzzle's move list",
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(choosePuzzleLineMove, actor, 1);
  }
);
