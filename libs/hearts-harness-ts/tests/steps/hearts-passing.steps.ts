/**
 * Passing three cards: the deals that await passes, each player's secret
 * pass from their own hand with the board's gestures, what everyone sees of
 * who has passed, and the cards changing hands all at once.
 */

import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import { passHeartsCards } from '@libs/hearts-harness-ts/hearts-actions';
import {
  awaitingPassesIn,
  fourthDealStarted,
} from '@libs/hearts-harness-ts/hearts-later-deals';
import type { HeartsView } from '@libs/hearts-harness-ts/hearts-view';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  chosen,
  guard,
  type HeartsWorld,
  hasPassed,
  held,
  noteChoice,
  pass,
  passedBy,
  people,
  plan,
  remember,
  remembered,
  SIDES,
  seated,
  sees,
  seesOnce,
  sideOf,
  sorted,
  table,
} from './hearts-world';

/** The first deal passes to the left: the seat each seat's pass goes to. */
const FIRST_DEAL_PASSES_TO: Readonly<Record<GameSide, GameSide>> = {
  white: 'black',
  black: 'red',
  red: 'blue',
  blue: 'white',
};

async function seatsPass(
  w: HeartsWorld,
  sides: readonly GameSide[]
): Promise<void> {
  await table(w);
  for (const side of sides) await pass(w, seated(w)[side]);
  await remember(w);
}

Given('the {heartsDeal} deal is awaiting passes', (w, deal: number) =>
  plan(w, { line: awaitingPassesIn(deal) })
);
Given('it is the fourth deal', (w) => plan(w, { line: fourthDealStarted() }));
Given(
  '{heartsSeat} has passed {heartsCards}, and {heartsSeat} and {heartsSeat} have passed',
  async (w, side: GameSide, cards: string[], ...others: GameSide[]) => {
    await table(w);
    await pass(w, seated(w)[side], cards);
    for (const other of others) await pass(w, seated(w)[other]);
    await remember(w);
  }
);
Given(
  '{heartsSeat}, {heartsSeat} and {heartsSeat} have passed',
  (w, ...sides: GameSide[]) => seatsPass(w, sides)
);
Given(
  'the first deal is awaiting passes and {heartsSeat}, {heartsSeat} and {heartsSeat} have passed',
  async (w, ...sides: GameSide[]) => {
    plan(w, { line: awaitingPassesIn(1) });
    await seatsPass(w, sides);
  }
);
Given(
  '{actor} has passed {heartsCards}',
  async (w, actor: string, cards: string[]) => {
    await table(w);
    await pass(w, actor, cards);
    await remember(w);
  }
);
Given('{actor} has passed since then', async (w, actor: string) => {
  await table(w);
  await pass(w, actor);
  await remember(w);
});
Given(
  '{heartsSeat} does not hold {heartsCard}',
  (w, side: GameSide, card: string) =>
    guard(w, async () => {
      expect(held(await sees(w, seated(w)[side]))).not.toContain(card);
    })
);

When(
  '{actor} passes {heartsCards}',
  async (w, actor: string, cards: string[]) => {
    await table(w);
    await w.s.apply(passHeartsCards, actor, cards);
    noteChoice(w, actor, cards);
  }
);
When(
  '{actor} passes only {heartsCards}',
  async (w, actor: string, cards: string[]) => {
    await table(w);
    await w.s.apply(passHeartsCards, actor, cards);
  }
);
When(
  '{actor} passes {heartsCards} with the keyboard',
  async (w, actor: string, cards: string[]) => {
    await table(w);
    await w.s.apply(passHeartsCards, actor, cards, true);
  }
);

/** `view` shows `side` has passed. */
function shownPassed(side: GameSide) {
  return (view: HeartsView) => hasPassed(view, side);
}

Then(
  '{actor} sees he/she has passed {heartsCards}',
  async (w, actor: string, cards: string[]) => {
    const view = await seesOnce(w, actor, shownPassed(sideOf(w, actor)));
    expect(sorted(chosen(view))).toEqual(sorted(cards));
    expect(view.pass).toBeNull();
  }
);
Then(
  '{actor}, {actor} and {actor} see {heartsSeat} has passed',
  async (w, ...named: string[]) => {
    const side = named[3] as GameSide;
    for (const actor of named.slice(0, 3))
      expect(hasPassed(await seesOnce(w, actor, shownPassed(side)), side)).toBe(
        true
      );
  }
);
Then(
  '{actor} sees {heartsSeat} has passed',
  async (w, actor: string, side: GameSide) => {
    expect(hasPassed(await seesOnce(w, actor, shownPassed(side)), side)).toBe(
      true
    );
  }
);
Then('{heartsSeat} has not passed', async (w, side: GameSide) => {
  for (const person of people(w)) {
    const view = await sees(w, person);
    expect(hasPassed(view, side)).toBe(false);
    expect(view.committed).not.toContain(side);
  }
});
Then(
  "{actor}'s pass is still {heartsCards}",
  async (w, actor: string, cards: string[]) => {
    expect(sorted(chosen(await sees(w, actor)))).toEqual(sorted(cards));
  }
);
Then(
  '{heartsSeat} receives {heartsCards}',
  async (w, side: GameSide, cards: string[]) => {
    const view = await seesOnce(w, seated(w)[side], (v) =>
      cards.every((card) => held(v).includes(card))
    );
    for (const card of cards) expect(held(view)).toContain(card);
  }
);
Then(
  'every player receives the three cards passed to them at the same time',
  async (w) => {
    const passes = passedBy(w);
    const seats = seated(w);
    const before = remembered(w, seats.white).screen.current?.moves.length ?? 0;
    for (const side of SIDES) {
      const giver = SIDES.find((each) => FIRST_DEAL_PASSES_TO[each] === side)!;
      const given = passes[giver] ?? [];
      const view = await seesOnce(
        w,
        seats[side],
        (v) => v.pass === null && v.hand.every((card) => !card.chosen)
      );
      expect(given).toHaveLength(3);
      for (const card of given) expect(held(view)).toContain(card);
      // Every pass changes hands in one move of the game, never one by one.
      expect(view.screen.current?.moves.length).toBe(before + 1);
    }
  }
);
Then('no passed card has changed hands', async (w) => {
  for (const side of SIDES) {
    const person = seated(w)[side];
    expect(sorted(held(await sees(w, person)))).toEqual(
      sorted(held(remembered(w, person)))
    );
  }
});
