import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import { pongControlledPaddles } from '@libs/pong-harness-ts/pong-controls-view';
import {
  establishPongLocalStage,
  finishLocalPong,
  startLocalPong,
} from '@libs/pong-harness-ts/pong-local-actions';
import {
  type PongLocalOpponent,
  type PongLocalStage,
  pongLocalView,
} from '@libs/pong-harness-ts/pong-local-view';
import type { PongPaddle } from '@libs/pong-harness-ts/pong-view';

Given(
  '{actor} has local Pong {pongLocalStage} against {pongLocalOpponent}',
  async (
    w,
    actor: string,
    stage: PongLocalStage,
    opponent: PongLocalOpponent
  ) => {
    await w.s.apply(establishPongLocalStage, { actor, stage, opponent });
  }
);
When('{actor} starts local Pong', async (w, actor: string) => {
  await w.s.apply(startLocalPong, actor);
});
When('local Pong finishes', async (w) => {
  await w.s.apply(finishLocalPong);
});
Then(
  "{actor}'s local Pong is {pongLocalStage}",
  async (w, actor: string, stage: PongLocalStage) => {
    const view = await w.s.until((s) => pongLocalView(s, actor), {
      pred: (shown) => shown.localStage === stage,
      maxMs: 5000,
    });
    expect(view.localStage).toBe(stage);
  }
);
Then(
  '{actor} can guide {pongPaddles} in Pong',
  async (w, actor: string, paddles: PongPaddle[]) => {
    const view = await w.s.until((s) => pongControlledPaddles(s, actor), {
      pred: (shown) => shown.length === paddles.length,
      maxMs: 5000,
    });
    expect(view).toEqual(paddles);
  }
);
Then('{actor} still has her local Pong game', async (w, actor: string) => {
  expect((await w.s.read(pongLocalView, actor)).gameShown).toBe(true);
});
Then(
  '{actor} cannot guide either paddle because Pong has finished',
  async (w, actor: string) => {
    expect((await w.s.read(pongLocalView, actor)).controlledPaddles).toEqual(
      []
    );
  }
);
