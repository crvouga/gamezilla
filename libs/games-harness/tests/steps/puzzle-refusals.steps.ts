/**
 * What a puzzle of the run's game refuses: a choice the solver sends for a
 * puzzle that is over, from an earlier position, before a retry or out of
 * the hints' order, as the space's room answers it; and stepping back
 * through the line to an earlier position.
 */

import { expect } from 'bun:test';
import type { HostPuzzleCommand } from '@libs/game-session-harness/puzzle-room-probe';
import {
  attemptHostPuzzleCommand,
  readLastPuzzleCommandOutcome,
  readLastPuzzleRefusal,
} from '@libs/game-session-harness/puzzle-room-probe';
import {
  readPuzzleProbe,
  stepThroughPuzzleLine,
  takePuzzleHint,
  takeSecondPuzzleHint,
} from '@libs/game-session-harness/puzzle-screen';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';
import { ensureOnPuzzle, puzzlePositionBeforeReviewKey } from './puzzle-world';

async function stepBack(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(focusActor, actor);
  const before = await w.s.read(readPuzzleProbe, actor);
  if (before === null) throw new Error(`${actor} has no puzzle to review`);
  w.memo.set(puzzlePositionBeforeReviewKey(actor), before.solveIdx);
  await w.s.apply(stepThroughPuzzleLine, actor, 'back');
}

Given('{actor} is reviewing an earlier position in the puzzle', stepBack);

When('{actor} steps back one move in the puzzle', stepBack);

Given('{actor} has seen the solution move', async (w, actor: Actor) => {
  await ensureOnPuzzle(w, actor);
  await w.s.apply(takePuzzleHint, actor);
  await w.s.apply(takeSecondPuzzleHint, actor);
});

When(
  '{actor} {puzzleCommandAttempt}',
  async (w, actor: Actor, command: HostPuzzleCommand) => {
    await w.s.apply(attemptHostPuzzleCommand, actor, actor, command);
  }
);

When(
  '{actor} tries to show the solution from that earlier position',
  async (w, actor: Actor) => {
    await w.s.apply(attemptHostPuzzleCommand, actor, actor, 'show-line');
  }
);

Then(
  "{actor}'s choice is refused because {puzzleRefusal}",
  async (w, _actor: Actor, reason: string) => {
    const outcome = await w.s.read(readLastPuzzleCommandOutcome);
    expect(outcome.kind).toBe('refused');
    expect(await w.s.read(readLastPuzzleRefusal)).toBe(reason);
    if (outcome.kind === 'refused')
      expect(outcome.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  }
);
