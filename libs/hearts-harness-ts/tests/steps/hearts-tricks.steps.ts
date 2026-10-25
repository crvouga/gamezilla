/**
 * Tricks: the tables the scenarios name (who has led what, what each hand
 * holds), cards played with the board's gestures, and the trick, the turn
 * and the hands as people see them.
 */

import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import { playHeartsCard } from '@libs/hearts-harness-ts/hearts-actions';
import {
  HEARTS_BROKEN_TABLE,
  HEARTS_UNBROKEN_TABLE,
  type HeartsTable,
  NORTH_LEADS_THIRD_TABLE,
  NORTH_TWO_TABLE,
  SOUTH_HEARTS_TABLE,
  TRICK_TABLE,
  WEST_HEARTS_TABLE,
  WEST_LEADS_FOURTH_TABLE,
  WEST_LEADS_SECOND_TABLE,
  WEST_VOID_TABLE,
} from '@libs/hearts-harness-ts/hearts-tables';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  deciding,
  guard,
  type HeartsWorld,
  held,
  holds,
  people,
  plan,
  planned,
  remembered,
  seated,
  sees,
  seesOnce,
  table,
  trick,
} from './hearts-world';

/** The table and stage a Given names, unless an earlier Given chose the table. */
function stage(w: HeartsWorld, name: string, fallback: HeartsTable): void {
  plan(w, { stage: name, table: planned(w).table ?? fallback });
}

/** `side`'s hand, once the table is set up, satisfies `check`. */
function handOf(
  w: HeartsWorld,
  side: GameSide,
  check: (hand: readonly string[]) => void
): void {
  guard(w, async () => check(held(await sees(w, seated(w)[side]))));
}

const suit = (card: string) => card[1];

/** Once set up, the trick shown has `side`'s `card` in it. */
function inTrick(w: HeartsWorld, side: GameSide, card: string): void {
  guard(w, async () => {
    expect(trick(await sees(w, seated(w).white))[side]).toBe(card);
  });
}

/** Once set up, the first deal's `number`th trick, as the moves list it, held `card`. */
function inFirstDealTrick(w: HeartsWorld, number: number, card: string): void {
  guard(w, async () => {
    const moves = (await sees(w, seated(w).white)).screen.current?.moves ?? [];
    // The first deal's pass, then each trick's four cards.
    const cards = moves.slice(1 + (number - 1) * 4, 1 + number * 4);
    expect(cards.map((move) => move.uci)).toContain(card);
  });
}

Given(
  'every player has passed in the first deal and {heartsSeat} holds {heartsCard}',
  (w, side: GameSide, card: string) => {
    plan(w, { table: NORTH_TWO_TABLE, stage: 'passed' });
    handOf(w, side, (hand) => expect(hand).toContain(card));
  }
);
Given(
  '{heartsSeat} has led {heartsCard} to the first trick',
  (w, side: GameSide, card: string) => {
    stage(w, 'south led', TRICK_TABLE);
    inTrick(w, side, card);
  }
);
Given('{heartsSeat} has led the second trick of the first deal', (w) =>
  plan(w, { table: WEST_LEADS_SECOND_TABLE, stage: 'west led second' })
);
Given(
  '{heartsSeat} has led {heartsCard} to the third trick',
  (w, side: GameSide, card: string) => {
    plan(w, { table: NORTH_LEADS_THIRD_TABLE, stage: 'north led third' });
    inTrick(w, side, card);
  }
);
Given(
  '{heartsSeat} has led {heartsCard} to the fourth trick',
  (w, side: GameSide, card: string) => {
    plan(w, { table: WEST_LEADS_FOURTH_TABLE, stage: 'west led fourth' });
    inTrick(w, side, card);
  }
);
Given(
  '{heartsSeat} has played {heartsCard} and {heartsSeat} {heartsCard}',
  (w, ...played: string[]) => {
    plan(w, { stage: 'north and east played' });
    inTrick(w, played[0] as GameSide, played[1]!);
    inTrick(w, played[2] as GameSide, played[3]!);
  }
);
Given(
  "it is {heartsSeat}'s turn to lead the fifth trick of the first deal, holding hearts and clubs",
  (w, side: GameSide) => {
    stage(w, 'south leads fifth', HEARTS_UNBROKEN_TABLE);
    handOf(w, side, (hand) =>
      expect(new Set(hand.map(suit))).toEqual(new Set(['C', 'H']))
    );
  }
);
Given(
  "no heart has been played in the first deal and it is {heartsSeat}'s turn to lead the fifth trick",
  (w) => stage(w, 'south leads fifth', HEARTS_UNBROKEN_TABLE)
);
Given(
  '{heartsSeat} played {heartsCard} in the third trick',
  (w, _side: GameSide, card: string) => {
    plan(w, { table: HEARTS_BROKEN_TABLE });
    inFirstDealTrick(w, 3, card);
  }
);
Given(
  '{heartsSeat} played {heartsCard} in the third trick and no heart has been played in this deal',
  (w, _side: GameSide, card: string) => {
    plan(w, { table: HEARTS_UNBROKEN_TABLE });
    inFirstDealTrick(w, 3, card);
  }
);
Given('{heartsSeat} holds hearts and clubs', (w, side: GameSide) => {
  plan(w, { table: HEARTS_UNBROKEN_TABLE });
  handOf(w, side, (hand) =>
    expect(new Set(hand.map(suit))).toEqual(new Set(['C', 'H']))
  );
});
Given('{heartsSeat} holds only hearts', (w, side: GameSide) => {
  plan(w, { table: SOUTH_HEARTS_TABLE });
  handOf(w, side, (hand) =>
    expect(new Set(hand.map(suit))).toEqual(new Set(['H']))
  );
});
Given(
  '{heartsSeat} holds {heartsCards}',
  (w, side: GameSide, cards: string[]) =>
    handOf(w, side, (hand) => {
      for (const card of cards) expect(hand).toContain(card);
    })
);
Given(
  '{heartsSeat} holds {heartsCards} but not {heartsCard}',
  (w, side: GameSide, cards: string[], not: string) =>
    handOf(w, side, (hand) => {
      for (const card of cards) expect(hand).toContain(card);
      expect(hand).not.toContain(not);
    })
);
Given(
  '{heartsSeat} holds {heartsCard} and no other club',
  (w, side: GameSide, card: string) =>
    handOf(w, side, (hand) =>
      expect(hand.filter((each) => suit(each) === 'C')).toEqual([card])
    )
);
Given('{heartsSeat} holds no clubs', (w, side: GameSide) =>
  handOf(w, side, (hand) =>
    expect(hand.filter((card) => suit(card) === 'C')).toEqual([])
  )
);
Given(
  '{heartsSeat} holds no clubs, but holds {heartsCards}',
  (w, side: GameSide, cards: string[]) => {
    plan(w, { table: WEST_VOID_TABLE });
    handOf(w, side, (hand) => {
      expect(hand.filter((card) => suit(card) === 'C')).toEqual([]);
      for (const card of cards) expect(hand).toContain(card);
    });
  }
);
Given(
  '{heartsSeat} holds no clubs and holds only hearts and the queen of spades',
  (w, side: GameSide) => {
    plan(w, { table: WEST_HEARTS_TABLE });
    handOf(w, side, (hand) =>
      expect(hand.filter((card) => suit(card) !== 'H')).toEqual(['QS'])
    );
  }
);

When('{actor} plays {heartsCard}', async (w, actor: string, card: string) => {
  await table(w);
  await w.s.apply(playHeartsCard, actor, card);
});
When(
  '{actor} plays {heartsCard} with the keyboard',
  async (w, actor: string, card: string) => {
    await table(w);
    await w.s.apply(playHeartsCard, actor, card, true);
  }
);
When('{actor} leads {heartsCard}', async (w, actor: string, card: string) => {
  await table(w);
  await w.s.apply(playHeartsCard, actor, card);
});

/** The person whose view of the trick a Then reads: the table's host. */
function host(w: HeartsWorld): string {
  return people(w)[0]!;
}

Then('{heartsCard} leads the first trick', async (w, card: string) => {
  const view = await seesOnce(
    w,
    host(w),
    (v) => Object.values(trick(v)).length > 0
  );
  expect(Object.values(trick(view))).toEqual([card]);
});
Then('{heartsCard} leads the fifth trick', async (w, card: string) => {
  const before = remembered(w, host(w)).screen.current?.moves.length ?? 0;
  const view = await seesOnce(
    w,
    host(w),
    (v) => (v.screen.current?.moves.length ?? 0) > before
  );
  expect(view.screen.current?.moves.length).toBe(before + 1);
  expect(Object.values(trick(view))).toEqual([card]);
});
Then("it is {heartsSeat}'s turn", async (w, side: GameSide) => {
  for (const person of people(w))
    expect(
      deciding(await seesOnce(w, person, (v) => deciding(v) === side))
    ).toBe(side);
});
Then('{heartsCard} is in the current trick', async (w, card: string) => {
  const view = await seesOnce(w, host(w), (v) =>
    Object.values(trick(v)).includes(card)
  );
  expect(Object.values(trick(view))).toContain(card);
});
Then(
  'the current trick still holds only {heartsCard}',
  async (w, card: string) => {
    expect(Object.values(trick(await sees(w, host(w))))).toEqual([card]);
  }
);
Then('the current trick is unchanged', async (w) => {
  for (const person of people(w))
    expect(trick(await sees(w, person))).toEqual(trick(remembered(w, person)));
});
Then(
  '{heartsSeat} takes the trick with {heartsCard}',
  async (w, side: GameSide, card: string) => {
    const view = await seesOnce(
      w,
      host(w),
      (v) => Object.values(trick(v)).length === 4
    );
    expect(trick(view)[side]).toBe(card);
    const name = view.seats[side]?.name ?? '';
    expect(view.center).toContain(name.replace(' (you)', ''));
  }
);
Then(
  "it is {heartsSeat}'s turn to lead the next trick",
  async (w, side: GameSide) => {
    const view = await seesOnce(w, host(w), (v) => deciding(v) === side);
    expect(deciding(view)).toBe(side);
    expect(Object.values(trick(view))).toHaveLength(4);
  }
);
Then(
  '{actor} still holds {heartsCards}',
  async (w, actor: string, cards: string[]) => holds(w, actor, cards)
);
