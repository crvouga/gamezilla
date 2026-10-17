import { expect } from 'bun:test';
import { customGameNearestSide } from '@libs/game-session-harness/custom-game-reads';
import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { Then, When } from '@libs/harness/define';
import {
  choose,
  current,
  identityOf,
  race,
  sideShownTo,
} from './custom-game-set-up-world';
import { view } from './game-world';

When(
  '{actor} assigns a bot to the {gameSide}',
  async (w, actor: string, side: CustomGameSide) =>
    choose(w, actor, { operation: 'bot', side })
);
When(
  '{actor} opens the {gameSide}',
  async (w, actor: string, side: CustomGameSide) =>
    choose(w, actor, { operation: 'open', side })
);
When(
  '{actor} takes the {gameSide}',
  async (w, actor: string, side: CustomGameSide) =>
    choose(w, actor, { operation: 'take', side })
);
When(
  '{actor} closes the {gameSide}',
  async (w, actor: string, side: CustomGameSide) =>
    choose(w, actor, { operation: 'close', side })
);
When('{actor} swaps the sides', async (w, actor: string) =>
  choose(w, actor, { operation: 'swap' })
);
When(
  '{actor} claims the {gameSide}',
  async (w, actor: string, side: CustomGameSide) =>
    choose(w, actor, { operation: 'claim', side })
);
When(
  '{actor} releases the {gameSide}',
  async (w, actor: string, side: CustomGameSide) =>
    choose(w, actor, { operation: 'release', side })
);
When(
  '{actor} and {actor} claim the {gameSide} at the same time',
  async (w, first: string, second: string, side: CustomGameSide) =>
    race(w, [
      { actor: first, choice: { operation: 'claim', side } },
      { actor: second, choice: { operation: 'claim', side } },
    ])
);

Then(
  'the {gameSide} is either {actor} or {actor}',
  async (w, side: CustomGameSide, first: string, second: string) => {
    const seat = (await current(w))[side];
    expect(seat.kind).toBe('person');
    expect([await identityOf(w, first), await identityOf(w, second)]).toContain(
      seat.person
    );
  }
);
Then(
  'the {gameSide} is either {actor} or open',
  async (w, side: CustomGameSide, person: string) => {
    const seat = (await current(w))[side];
    expect([
      { kind: 'person', person: await identityOf(w, person) },
      { kind: 'open', person: '' },
    ]).toContainEqual(seat);
  }
);
Then(
  'the {gameSide} has at most one participant',
  async (w, side: CustomGameSide) => {
    // Everyone in the scenario, as each of their own devices sees it.
    const holders: string[] = [];
    for (const person of ['alice', 'bob', 'carol'])
      if ((await w.s.read(sideShownTo, person)) === side) holders.push(person);
    expect(holders.length).toBeLessThanOrEqual(1);
  }
);

Then('{actor} is watching the custom game', async (w, actor: string) => {
  const seen = await view(w, actor);
  expect(seen.mySide).toBeNull();
  expect(seen.gates['watch']).toBe(true);
});
Then('both sides are bots in the custom game under way', async (w) => {
  const game = await current(w);
  expect(game.status).toBe('active');
  expect([game.white.kind, game.black.kind]).toEqual(['bot', 'bot']);
});
Then(
  '{actor} sees the {gameSide} nearest him/her',
  async (w, actor: string, side: CustomGameSide) => {
    expect(
      await w.s.until((s) => customGameNearestSide(s, actor), {
        pred: (near) => near === side,
      })
    ).toBe(side);
  }
);
