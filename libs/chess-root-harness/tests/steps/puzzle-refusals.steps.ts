import { expect } from 'bun:test';
import {
  finishPuzzleBy,
  leaveChessMenuToGameMenu,
  requestPuzzleHint,
  revealPuzzleSolution,
} from '@libs/chess-puzzle-harness/chess-actions';
import type { HostPuzzleCommand } from '@libs/chess-puzzle-harness/chess-puzzle-room-probe';
import {
  attemptHostPuzzleCommand,
  readLastPuzzleCommandOutcome,
  readLastPuzzleRefusal,
} from '@libs/chess-puzzle-harness/chess-puzzle-room-probe';
import { readPuzzleStatus } from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import {
  pressPuzzleRetryIfVisible,
  stepPuzzlePosition,
} from '@libs/chess-puzzle-harness/puzzle-assistant-ui';
import {
  readPuzzleControlAvailability,
  readPuzzleView,
} from '@libs/chess-puzzle-harness/puzzle-control-reads';
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
  await w.s.apply(requestPuzzleHint, actor);
  await w.s.apply(revealPuzzleSolution, actor);
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
    expect(await w.s.read(readPuzzleStatus, actor)).toBe(state);
  }
);

When(
  '{actor} tries to retry before a wrong move or result',
  async (w, actor: Actor) => {
    await w.s.apply(pressPuzzleRetryIfVisible, actor);
  }
);
Then('{actor} is not offered to retry', async (w, actor: Actor) => {
  expect(
    (await w.s.read(readPuzzleControlAvailability, actor)).retryOffered
  ).toBe(false);
});

When(
  '{actor} goes back from the chess choices to the game choice',
  async (w, actor: Actor) => {
    await w.s.apply(leaveChessMenuToGameMenu, actor);
  }
);
Then("{actor} sees the space's game choice", async (w, actor: Actor) => {
  expect(await w.s.read(readPuzzleView, actor)).toBe('GameChoice');
});
When('{actor} reopens the app on the puzzle', async (w, actor: Actor) => {
  await w.s.apply(restartApp, actor);
  await w.s.apply(returnToOwnSpace, actor);
});
When(
  '{actor} steps forward one move in the puzzle',
  async (w, actor: Actor) => {
    await w.s.apply(stepPuzzlePosition, actor, 'forward');
  }
);

When(
  '{actor} tries to show the solution from that earlier position',
  async (w, actor: Actor) => {
    await w.s.apply(attemptHostPuzzleCommand, actor, actor, 'show-line');
  }
);
