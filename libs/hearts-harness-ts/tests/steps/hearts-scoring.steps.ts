/**
 * Scoring: deals whose last card is still to be played, the deal's scores
 * as the cumulative scores change, and a Hearts game that is over.
 */

import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import { playDealsLastCard } from '@libs/hearts-harness-ts/hearts-actions';
import {
  fiveDealsScored,
  sixthDealButLastCard,
} from '@libs/hearts-harness-ts/hearts-five-deals';
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
  type HeartsWorld,
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

/** The game once five deals are scored, its scores confirmed as the board shows them. */
function afterFiveDeals(w: HeartsWorld, scores: readonly number[]): void {
  plan(w, { line: fiveDealsScored() });
  guard(w, async () => {
    const view = await sees(w, seated(w).white);
    expect(SIDES.map((side) => score(view, side))).toEqual([...scores]);
  });
}

Given(
  'it is the sixth deal, and after five deals the scores stand at South {int}, West {int}, North {int} and East {int}',
  (w, ...scores: number[]) => afterFiveDeals(w, scores)
);
Given(
  'after five deals the scores stand at South {int}, West {int}, North {int} and East {int}',
  (w, ...scores: number[]) => afterFiveDeals(w, scores)
);

Given(
  'in this deal South took {int} penalty points, West {int}, North {int} and East {int}',
  (w, ...taken: number[]) => {
    const line = sixthDealButLastCard(taken);
    if (line === null)
      throw new Error(`no known sixth deal gives ${taken.join(', ')}`);
    plan(w, { line });
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

/** What the table's host sees once the deal's last card has been played. */
function afterTheDeal(w: HeartsWorld) {
  const host = people(w)[0]!;
  const moves = remembered(w, host).screen.current?.moves.length ?? 0;
  return seesOnce(
    w,
    host,
    (v) => (v.screen.current?.moves.length ?? 0) > moves
  );
}

Then(
  'the cumulative scores are South {int}, West {int}, North {int} and East {int}',
  async (w, ...scores: number[]) => {
    const view = await afterTheDeal(w);
    expect(SIDES.map((side) => score(view, side))).toEqual(scores);
  }
);
Then('the seventh deal is dealt, passing across', async (w) => {
  await afterTheDeal(w);
  const view = await seesOnce(w, people(w)[0]!, (v) =>
    v.center.includes('across')
  );
  expect(view.screen.current?.status).toBe('active');
  for (const side of SIDES) expect(cardsHeldBy(view, side)).toBe(13);
});
Then('the Hearts game is over with no seventh deal', async (w) => {
  const view = await afterTheDeal(w);
  expect(view.screen.current?.status).toBe('completed');
  expect(view.hand).toEqual([]);
});
Then(
  'the Hearts game is over and {heartsSeat} wins alone with {int}',
  async (w, side: GameSide, lowest: number) => {
    const view = await afterTheDeal(w);
    expect(view.screen.current?.status).toBe('completed');
    expect(view.screen.current?.outcome).toStartWith(`${side} wins`);
    expect(score(view, side)).toBe(lowest);
    for (const other of SIDES.filter((each) => each !== side))
      expect(score(view, other)).toBeGreaterThan(lowest);
  }
);
Then(
  'the Hearts game is over and {heartsSeat} and {heartsSeat} share the victory with {int}',
  async (w, first: GameSide, second: GameSide, lowest: number) => {
    const view = await afterTheDeal(w);
    expect(view.screen.current?.status).toBe('completed');
    expect(view.screen.current?.outcome).toStartWith(
      `${first} and ${second} win`
    );
    for (const side of SIDES)
      if (side === first || side === second)
        expect(score(view, side)).toBe(lowest);
      else expect(score(view, side)).toBeGreaterThan(lowest);
  }
);

/** Every player and watcher sees the game over, the same final scores, and `winners`. */
async function everyoneSeesTheEnd(
  w: HeartsWorld,
  winners: (outcome: string) => boolean
): Promise<void> {
  const final = await afterTheDeal(w);
  for (const person of people(w)) {
    const view = await seesOnce(
      w,
      person,
      (v) => v.screen.current?.status === 'completed'
    );
    expect(winners(view.screen.current?.outcome ?? '')).toBe(true);
    for (const side of SIDES)
      expect(score(view, side)).toBe(score(final, side));
  }
}

Then(
  'every player and watcher sees the final scores and South as the winner',
  (w) => everyoneSeesTheEnd(w, (outcome) => outcome.startsWith('white wins'))
);
Then('every player and watcher sees the final scores and both winners', (w) =>
  everyoneSeesTheEnd(w, (outcome) => outcome.startsWith('white and red win'))
);
