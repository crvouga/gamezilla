import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  arrangeSharedPong,
  establishSharedPong,
  guideSharedPong,
  joinSharedPong,
} from '@libs/pong-harness-ts/pong-shared-actions';
import {
  type PongPlace,
  pongSharedView,
} from '@libs/pong-harness-ts/pong-shared-view';
import type { PongPaddle } from '@libs/pong-harness-ts/pong-view';

Given(
  '{actor} and {actor} were paired up for Pong with {actor} at the left paddle',
  (w) => w.s.apply(establishSharedPong)
);
Given(
  "{actor}'s Pong paddle is at the {pongPlace}",
  (w, actor: string, place: PongPlace) =>
    w.s.apply(arrangeSharedPong, actor, place)
);
Given(
  "{actor} is in {actor}'s space with no Pong paddle",
  (w, actor: string, host: string) => w.s.apply(joinSharedPong, actor, host)
);
When("{actor} joins {actor}'s space", (w, actor: string, host: string) =>
  w.s.apply(joinSharedPong, actor, host)
);
When(
  "{actor} (tries to )guide(s) Pong's {pongPaddle} paddle to the {pongPlace}",
  (w, actor: string, paddle: PongPaddle, place: PongPlace) =>
    w.s.apply(guideSharedPong, actor, paddle, place)
);

Then(
  "{actor} sees Pong's {pongPaddle} paddle at the {pongPlace}",
  async (w, actor: string, paddle: PongPaddle, place: PongPlace) => {
    const shown = await w.s.until((s) => pongSharedView(s, actor), {
      pred: (view) => view.paddlePlace.get(paddle) === place,
    });
    expect(shown.paddlePlace.get(paddle)).toBe(place);
  }
);
Then(
  "{actor} and {actor} see Pong's {pongPaddle} paddle at the {pongPlace}",
  async (
    w,
    ...[first, second, paddle, place]: [string, string, PongPaddle, PongPlace]
  ) => {
    for (const actor of [first, second]) {
      const shown = await w.s.until((s) => pongSharedView(s, actor), {
        pred: (view) => view.paddlePlace.get(paddle) === place,
      });
      expect(shown.paddlePlace.get(paddle)).toBe(place);
    }
  }
);
Then(
  '{actor} cannot guide the {pongPaddle} paddle because it belongs to {actor}',
  async (w, actor: string, paddle: PongPaddle, owner: string) => {
    const shown = await w.s.read(pongSharedView, actor);
    expect(shown.controlledPaddles).not.toContain(paddle);
    expect(shown.owners.get(paddle)?.toLowerCase()).toContain(owner);
  }
);
Then(
  '{actor} cannot guide either paddle because neither belongs to her',
  async (w, actor: string) => {
    expect((await w.s.read(pongSharedView, actor)).controlledPaddles).toEqual(
      []
    );
  }
);
Then(
  '{actor} cannot guide their paddle while {actor} has no connection',
  async (w, actor: string) => {
    expect(
      (
        await w.s.until((s) => pongSharedView(s, actor), {
          pred: (view) => view.controlledPaddles.length === 0,
        })
      ).controlledPaddles
    ).toEqual([]);
  }
);
