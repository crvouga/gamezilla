import { expect } from 'bun:test';
import type { HostPuzzleCommand } from '@libs/game-session-harness-ts/puzzle-room-probe';
import { attemptHostPuzzleCommand } from '@libs/game-session-harness-ts/puzzle-room-probe';
import {
  readPuzzleState,
  stepThroughPuzzleLine,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';

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

const returnFromEarlierBoard = scenarioAction({
  name: 'returnFromEarlierBoard',
  act: async (s, actor: Actor) => {
    const ui = await actorUi(s, actor);
    await ui.get('chess-puzzle-line-close').tap();
    await ui.get('chess-puzzle-return-live').tap();
    await ui
      .get('chess-puzzle-return-live')
      .expect.hidden({ timeoutMs: 20000 });
  },
});

When(
  '{actor} returns from the earlier board to the latest move',
  async (w, actor: Actor) => {
    await w.s.apply(returnFromEarlierBoard, actor);
  }
);
