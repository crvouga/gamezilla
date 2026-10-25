/**
 * Scoring: deals whose last card is still to be played, the deal's scores
 * as the cumulative scores change, and a Hearts game that is over.
 */

import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import { playDealsLastCard } from '@libs/hearts-harness-ts/hearts-actions';
import {
  southVictory,
  thirdDealLastCard,
} from '@libs/hearts-harness-ts/hearts-later-deals';
import {
  NORTH_MOON_TABLE,
  NORTH_TWENTY_FIVE_TABLE,
  SOUTH_SIXTEEN_TABLE,
} from '@libs/hearts-harness-ts/hearts-tables';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  cardsHeldBy,
  deciding,
  guard,
  held,
  people,
  plan,
  remembered,
  SIDES,
  score,
  seated,
  sees,
  seesOnce,
  table,
} from './hearts-world';

Given(
  'in this deal South took the queen of spades and three hearts, North the other ten hearts, and West and East no penalty points',
  (w) => plan(w, { table: SOUTH_SIXTEEN_TABLE, stage: 'last card' })
);
Given('in this deal North took every heart and the queen of spades', (w) =>
  plan(w, { table: NORTH_MOON_TABLE, stage: 'last card' })
);
Given(
  'in this deal North took the queen of spades and every heart but the two of hearts, which East took',
  (w) => plan(w, { table: NORTH_TWENTY_FIVE_TABLE, stage: 'last card' })
);
Given('the Hearts game is over with South the winner', (w) =>
  plan(w, { line: southVictory() })
);
Given(
  'only the last card of the third deal is still to be played and every cumulative score is below 50',
  (w) => {
    plan(w, { line: thirdDealLastCard() });
    guard(w, async () => {
      const view = await sees(w, seated(w).white);
      for (const side of SIDES) expect(score(view, side)).toBeLessThan(50);
    });
  }
);

When('the deal is scored', async (w) => {
  await table(w);
  await w.s.apply(playDealsLastCard, seated(w).white);
});

Then(
  "the deal's scores are South {int}, West {int}, North {int} and East {int}",
  async (w, ...scores: number[]) => {
    const host = people(w)[0]!;
    const before = remembered(w, host);
    const moves = before.screen.current?.moves.length ?? 0;
    const view = await seesOnce(
      w,
      host,
      (v) => (v.screen.current?.moves.length ?? 0) > moves
    );
    expect(
      SIDES.map((side) => score(view, side) - score(before, side))
    ).toEqual(scores);
  }
);
Then('the final scores and winner are unchanged', async (w) => {
  for (const person of people(w)) {
    const view = await sees(w, person);
    const before = remembered(w, person);
    expect(view.screen.current?.outcome).not.toBe('');
    expect(view.screen.current?.outcome).toBe(before.screen.current?.outcome);
    for (const side of SIDES)
      expect(score(view, side)).toBe(score(before, side));
  }
});
Then('the fourth deal is dealt with no passing', async (w) => {
  const host = people(w)[0]!;
  const moves = remembered(w, host).screen.current?.moves.length ?? 0;
  const view = await seesOnce(
    w,
    host,
    (v) => (v.screen.current?.moves.length ?? 0) > moves
  );
  expect(view.pass).toBeNull();
  for (const side of SIDES) {
    expect(cardsHeldBy(view, side)).toBe(13);
    expect(view.seats[side]?.facts).not.toContain('Choosing');
    expect(view.seats[side]?.facts).not.toContain('Passed');
  }
});
Then('the player who holds the two of clubs has the turn', async (w) => {
  const seats = seated(w);
  const holder: GameSide[] = [];
  for (const side of SIDES)
    if (held(await sees(w, seats[side])).includes('2C')) holder.push(side);
  expect(holder).toHaveLength(1);
  for (const person of people(w))
    expect(
      deciding(await seesOnce(w, person, (v) => deciding(v) === holder[0]))
    ).toBe(holder[0] ?? null);
});
