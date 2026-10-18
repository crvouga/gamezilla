import { expect } from 'bun:test';
import { finishPuzzleBy } from '@libs/chess-puzzle-harness/chess-actions';
import type { HostPuzzleCommand } from '@libs/game-session-harness/puzzle-room-probe';
import {
  attemptHostPuzzleCommand,
  readLastPuzzleCommandOutcome,
  readLastPuzzleRefusal,
} from '@libs/game-session-harness/puzzle-room-probe';
import {
  readPuzzleState,
  stepThroughPuzzleLine,
  takePuzzleHint,
  takeSecondPuzzleHint,
} from '@libs/game-session-harness/puzzle-screen';
import { restartApp } from '@libs/harness/actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor, PuzzleFinishName } from '@libs/harness/parameter-types';
import { returnToOwnSpace } from '@libs/spaces-harness/space-actions';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared/types';

Given(
  '{actor} has finished this puzzle by {finish}',
  async (w, actor: Actor, finish: PuzzleFinishName) => {
    await w.s.apply(finishPuzzleBy, actor, finish);
  }
);

Given('{actor} has seen the solution move', async (w, actor: Actor) => {
  await w.s.apply(takePuzzleHint, actor);
  await w.s.apply(takeSecondPuzzleHint, actor);
});

When(
  '{actor} {puzzleCommandAttempt}',
  async (w, actor: Actor, command: HostPuzzleCommand) => {
    await w.s.apply(attemptHostPuzzleCommand, actor, actor, command);
  }
);

Then(
  "{actor}'s action is refused because {puzzleRefusal}",
  async (w, _actor: Actor, reason: string) => {
    const outcome = await w.s.read(readLastPuzzleCommandOutcome);
    expect(outcome.kind).toBe('refused');
    expect(await w.s.read(readLastPuzzleRefusal)).toBe(reason);
    if (outcome.kind === 'refused')
      expect(outcome.error.type).toBe(ROOM_ERROR_TYPE.conflict);
  }
);

Then(
  "{actor}'s puzzle remains {word}",
  async (w, actor: Actor, state: string) => {
    expect(await w.s.read(readPuzzleState, actor)).toBe(state);
  }
);

When('{actor} reopens the app on the puzzle', async (w, actor: Actor) => {
  await w.s.apply(restartApp, actor);
  await w.s.apply(returnToOwnSpace, actor);
});
When(
  '{actor} steps forward one move in the puzzle',
  async (w, actor: Actor) => {
    await w.s.apply(stepThroughPuzzleLine, actor, 'forward');
  }
);

When(
  '{actor} tries to show the solution from that earlier position',
  async (w, actor: Actor) => {
    await w.s.apply(attemptHostPuzzleCommand, actor, actor, 'show-line');
  }
);
