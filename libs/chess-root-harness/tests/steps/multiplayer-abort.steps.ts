import { expect } from 'bun:test';
import {
  bothBoards,
  gameCommand,
  refusal,
  sameBoards,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness/multiplayer-time';
import { Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';

const SECOND_MS = 1000;

function passing(w: HarnessWorld, seconds: number) {
  return w.s.apply(passMultiplayerTime, seconds * SECOND_MS);
}

When('{int} seconds pass in multiplayer chess', passing);

When('{actor} aborts the multiplayer game', async (w, actor: Actor) => {
  await gameCommand(w, actor, 'abortMultiplayer');
});
Then('both people see the multiplayer game was aborted', async (w) => {
  expect((await bothBoards(w, (g) => g.outcome === 'aborted')).outcome).toBe(
    'aborted'
  );
});

Then(
  '{actor} sees the multiplayer game was aborted',
  async (w, actor: Actor) => {
    const game = await sameBoards(
      w,
      actor,
      actor,
      (g) => g.outcome === 'aborted'
    );
    expect(game.outcome).toBe('aborted');
  }
);
Then(
  '{actor} is told the multiplayer game can no longer be aborted',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_ABORT_TOO_LATE')
);
Then('the multiplayer game is still unfinished', async (w) => {
  expect((await bothBoards(w)).outcome).toBe('ongoing');
});
