import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  arrangePongScore,
  beginLocalPong,
  establishLocalPong,
  finishPongCountdown,
  winPongPoint,
} from '@libs/pong-harness-ts/pong-actions';
import { pongMoveListOffered } from '@libs/pong-harness-ts/pong-controls-view';
import {
  type PongPaddle,
  pongPoints,
  pongStageShown,
  pongVictor,
  pongView,
} from '@libs/pong-harness-ts/pong-view';

Given(
  '{actor} and {actor} have a Pong game on one device with {actor} at the left paddle',
  async (w) => {
    await w.s.apply(establishLocalPong, false);
  }
);
Given('Pong is counting down for the first serve', async (w) => {
  await w.s.apply(beginLocalPong);
});
Given(
  'Pong is in play with a target score of {int}',
  async (w, target: number) => {
    await w.s.apply(arrangePongScore, {
      left: 0,
      right: 0,
      targetScore: target,
      playing: true,
    });
  }
);
Given(
  '{actor} has {int} Pong point and {actor} has {int} with a target score of {int}',
  async (w, ...score: [string, number, string, number, number]) => {
    const [_left, left, _right, right, target] = score;
    await w.s.apply(arrangePongScore, {
      left,
      right,
      targetScore: target,
      playing: true,
    });
  }
);
Given(
  '{actor} has won Pong by {int} points to {int}',
  async (w, _actor: string, left: number, right: number) => {
    await w.s.apply(arrangePongScore, { left, right, targetScore: left });
  }
);
Given(
  'Pong is {pongStage} with a score of {int} to {int} and a target score of {int}',
  async (w, stage: string, ...score: [number, number, number]) => {
    const [left, right, target] = score;
    await w.s.apply(arrangePongScore, {
      left,
      right,
      targetScore: target,
      playing: stage === 'in play',
    });
  }
);

When('the Pong countdown ends', async (w) => {
  await w.s.apply(finishPongCountdown);
});
When(
  'the ball passes the {pongPaddle} paddle',
  async (w, paddle: PongPaddle) => {
    await w.s.apply(winPongPoint, paddle === 'right' ? 'left' : 'right');
  }
);
When('{int} seconds pass', async (w, seconds: number) => {
  await w.s.advanceTime(seconds * 1000);
});

Then('the ball is in play', async (w) => {
  expect((await w.s.read(pongView)).stage).toBe('playing');
});
Then(
  'the Pong score is still {int} to {int}',
  async (w, left: number, right: number) => {
    expect((await w.s.read(pongView)).score).toEqual({ left, right });
  }
);
Then(
  '{actor} has {int} Pong point',
  async (w, actor: string, points: number) => {
    expect(await w.s.read(pongPoints, actor)).toBe(points);
  }
);
Then('Pong is counting down for the next serve', async (w) => {
  expect((await w.s.read(pongView)).stage).toBe('countdown');
});
Then('{actor} wins Pong', async (w, actor: string) => {
  expect(await w.s.read(pongVictor)).toBe(actor);
});
Then('the Pong ball has stopped', async (w) => {
  const before = (await w.s.read(pongView)).ball;
  await w.s.never(pongView, {
    forMs: 500,
    pred: (view) => view.ball.x !== before.x || view.ball.y !== before.y,
  });
});
Then('Pong is {pongStage}', async (w, stage: string) => {
  const shown = await w.s.until(pongStageShown, {
    maxMs: 5000,
    stepMs: 25,
    pred: (value) => value === stage,
  });
  expect(shown).toBe(stage);
});

Then(
  '{actor} is not offered a move list in Pong because both paddles can be guided at once',
  async (w, actor: string) => {
    expect(await w.s.read(pongMoveListOffered, actor)).toBe(false);
  }
);
