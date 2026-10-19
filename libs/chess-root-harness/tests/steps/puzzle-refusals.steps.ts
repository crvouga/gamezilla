import { expect } from 'bun:test';
import type { HostPuzzleCommand } from '@libs/game-session-harness/puzzle-room-probe';
import { attemptHostPuzzleCommand } from '@libs/game-session-harness/puzzle-room-probe';
import {
  readPuzzleState,
  stepThroughPuzzleLine,
} from '@libs/game-session-harness/puzzle-screen';
import { Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

When(
  '{actor} {puzzleCommandAttempt}',
  async (w, actor: Actor, command: HostPuzzleCommand) => {
    await w.s.apply(attemptHostPuzzleCommand, actor, actor, command);
  }
);

Then(
  "{actor}'s puzzle remains {word}",
  async (w, actor: Actor, state: string) => {
    expect(await w.s.read(readPuzzleState, actor)).toBe(state);
  }
);

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
