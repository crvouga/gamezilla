/**
 * Who plays Hearts and how a Hearts game begins and begins again: four
 * people, or people and bots, seated and ready; the start that deals every
 * hand; the game's choices; and the rematch.
 */

import { expect } from 'bun:test';
import { operateCustomGame } from '@libs/game-session-harness-ts/custom-game-controls';
import { configureCustomGameChoice } from '@libs/game-session-harness-ts/custom-game-ui';
import {
  goBackInGame,
  offeredGameChoices,
  openGameChoice,
  pickGame,
} from '@libs/game-session-harness-ts/game-navigation';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  playHeartsUntilLastCard,
  playLastHeartsCard,
} from '@libs/hearts-harness-ts/hearts-actions';
import { southVictory } from '@libs/hearts-harness-ts/hearts-later-deals';
import { DEAL_POINTS } from '@libs/hearts-shared-ts/hearts-cards';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  cardsHeldBy,
  held,
  people,
  plan,
  remember,
  remembered,
  SIDES,
  score,
  sees,
  seesOnce,
  table,
} from './hearts-world';

type Four<T> = [T, T, T, T];

function seatsNamed(
  named: readonly (string | GameSide)[]
): Partial<Record<GameSide, string>> {
  const persons = named.slice(0, 4) as Four<string>;
  const sides = named.slice(4) as Four<GameSide>;
  return Object.fromEntries(sides.map((side, at) => [side, persons[at]!]));
}

Given(
  '{actor}, {actor}, {actor} and {actor} are ready for a custom game of Hearts as {heartsSeat}, {heartsSeat}, {heartsSeat} and {heartsSeat}',
  async (w, ...named: string[]) => {
    plan(w, { seats: seatsNamed(named), active: false });
    await table(w);
  }
);
// The table is set up once the Givens after this one have said how far it has gone.
Given(
  '{actor}, {actor}, {actor} and {actor} are playing Hearts as {heartsSeat}, {heartsSeat}, {heartsSeat} and {heartsSeat}',
  (w, ...named: string[]) => plan(w, { seats: seatsNamed(named) })
);
Given(
  '{actor} and {actor} are ready for a custom game of Hearts as {heartsSeat} and {heartsSeat}, with bots as {heartsSeat} and {heartsSeat}',
  async (w, ...named: string[]) => {
    const [first, second, mine, theirs, bot, other] = named;
    plan(w, {
      seats: {
        [mine as GameSide]: first,
        [theirs as GameSide]: second,
        [bot as GameSide]: 'bot',
        [other as GameSide]: 'bot',
      },
      active: false,
    });
    await table(w);
  }
);
Given(
  '{actor} is {heartsSeat} in a Hearts custom game against three bots',
  async (w, actor: string, side: GameSide) => {
    plan(w, {
      seats: Object.fromEntries(
        SIDES.map((each) => [each, each === side ? actor : 'bot'])
      ),
    });
    await table(w);
  }
);
Given(
  '{actor}, {actor}, {actor} and {actor} are {heartsSeat}, {heartsSeat}, {heartsSeat} and {heartsSeat} in a Hearts game that is over',
  async (w, ...named: string[]) => {
    plan(w, { seats: seatsNamed(named), line: southVictory() });
    await table(w);
  }
);
Given(
  '{actor} has passed and played every card of the first deal but her/his last',
  async (w, actor: string) => {
    await table(w);
    await w.s.apply(playHeartsUntilLastCard, actor);
    await remember(w);
  }
);
Given(
  '{actor} has asked for a rematch and all four people are ready for the custom game',
  async (w, actor: string) => {
    await table(w);
    await w.s.apply(configureCustomGameChoice, actor, { operation: 'rematch' });
    for (const person of people(w))
      await w.s.apply(configureCustomGameChoice, person, {
        operation: 'ready',
      });
    await remember(w);
  }
);
Given("Hearts is the game of {actor}'s space", async (w, actor: string) => {
  await w.s.apply(signInWithGoogle, actor);
  await w.s.apply(createSpace, actor);
  await w.s.apply(pickGame, actor, 'hearts');
  await w.s.apply(openGameChoice, actor, 'custom-game');
});

When('{actor} starts the custom game', async (w, actor: string) => {
  await table(w);
  await w.s.apply(operateCustomGame, actor, { operation: 'start' });
});
When('{actor} plays her/his last card', async (w, actor: string) => {
  await table(w);
  await w.s.apply(playLastHeartsCard, actor);
});
When('{actor} asks for a rematch', async (w, actor: string) => {
  await table(w);
  await w.s.apply(operateCustomGame, actor, { operation: 'rematch' });
});
When("{actor} opens the game's choices", async (w, actor: string) => {
  await w.s.apply(goBackInGame, actor);
});

Then(
  'each player holds 13 cards and every card of the deck is in exactly one hand',
  async (w) => {
    const hands: string[] = [];
    for (const person of people(w)) {
      const hand = held(await seesOnce(w, person, (v) => v.hand.length > 0));
      expect(hand).toHaveLength(13);
      hands.push(...hand);
    }
    expect(new Set(hands).size).toBe(52);
  }
);
Then('each player holds 13 cards', async (w) => {
  for (const person of people(w)) {
    const view = await seesOnce(w, person, (v) => v.hand.length > 0);
    expect(held(view)).toHaveLength(13);
    for (const side of SIDES) expect(cardsHeldBy(view, side)).toBe(13);
  }
});
Then(
  '{actor} and {actor} see {heartsSeat} and {heartsSeat} shown as bots',
  async (w, ...named: string[]) => {
    const [first, second, bot, other] = named as Four<string>;
    for (const person of [first, second]) {
      const game = (await sees(w, person)).screen.current;
      expect(game?.[bot as GameSide].kind).toBe('bot');
      expect(game?.[other as GameSide].kind).toBe('bot');
    }
  }
);
Then(
  'every player has played 13 cards and the first deal is scored',
  async (w) => {
    const before = remembered(w, people(w)[0]!).screen.current?.moves.length;
    // The first deal's pass, then its 52 cards.
    const view = await seesOnce(
      w,
      people(w)[0]!,
      (v) => (v.screen.current?.moves.length ?? 0) >= 53 && v.hand.length === 13
    );
    expect(before).toBeLessThan(53);
    const scores = SIDES.map((side) => score(view, side));
    const total = scores.reduce((sum, each) => sum + each, 0);
    expect([DEAL_POINTS, 3 * DEAL_POINTS]).toContain(total);
  }
);
Then('the second deal is dealt, passing to the right', async (w) => {
  const view = await seesOnce(w, people(w)[0]!, (v) =>
    v.center.includes('to the right')
  );
  expect(held(view)).toHaveLength(13);
  for (const side of SIDES) expect(cardsHeldBy(view, side)).toBe(13);
});
Then('{actor} is offered custom games of Hearts', async (w, actor: string) => {
  expect(await w.s.read(offeredGameChoices, actor)).toContain('custom-game');
});
Then('pairing people up is not offered for Hearts', async (w) => {
  expect(await w.s.read(offeredGameChoices, 'alice')).not.toContain(
    'multiplayer'
  );
});
Then(
  'the rematch has {actor} as {heartsSeat}, {actor} as {heartsSeat}, {actor} as {heartsSeat} and {actor} as {heartsSeat}',
  async (w, ...named: string[]) => {
    const game = (
      await seesOnce(
        w,
        'alice',
        (v) => v.screen.current?.status === 'configuring'
      )
    ).screen.current;
    for (let at = 0; at < 8; at += 2) {
      const person = named[at]!;
      const side = named[at + 1] as GameSide;
      expect(game?.[side].person).toBe((await sees(w, person)).screen.me);
    }
  }
);
Then('every cumulative score is 0', async (w) => {
  const view = await seesOnce(w, 'alice', (v) => v.hand.length === 13);
  for (const side of SIDES) expect(score(view, side)).toBe(0);
});
Then('the first deal is awaiting passes to the left', async (w) => {
  const view = await seesOnce(w, 'alice', (v) => v.hand.length === 13);
  expect(view.screen.current?.moves).toEqual([]);
  expect(view.center).toContain('to the left');
  expect(view.pass).not.toBeNull();
});
