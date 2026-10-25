/**
 * Following Hearts by listening and without colour: what the board says in
 * words and marks, and what someone listening hears.
 */

import { expect } from 'bun:test';
import { Given, Then } from '@libs/harness-ts/define';
import { listenToHearts } from '@libs/hearts-harness-ts/hearts-actions';
import { heartsHeard } from '@libs/hearts-harness-ts/hearts-view';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  deciding,
  type HeartsWorld,
  hasPassed,
  people,
  SIDES,
  score,
  sees,
  seesOnce,
  table,
  trick,
} from './hearts-world';

const SEAT_NAMES: Readonly<Record<GameSide, string>> = {
  white: 'South',
  black: 'West',
  red: 'North',
  blue: 'East',
};
const SUIT_NAMES: Readonly<Record<string, string>> = {
  C: 'clubs',
  D: 'diamonds',
  S: 'spades',
  H: 'hearts',
};
const SUIT_SYMBOLS: Readonly<Record<string, string>> = {
  C: '♣',
  D: '♦',
  S: '♠',
  H: '♥',
};
const RANK_NAMES: Readonly<Record<string, string>> = {
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  T: 'ten',
  J: 'jack',
  Q: 'queen',
  K: 'king',
  A: 'ace',
};

/** What `actor` hears, once it says every one of `words`. */
function hears(w: HeartsWorld, actor: string, words: readonly RegExp[]) {
  return w.s.until((s) => heartsHeard(s, actor), {
    maxMs: 15_000,
    pred: (heard) => words.every((word) => word.test(heard)),
  });
}

Given('{actor} is listening to the app', async (w, actor: string) => {
  await table(w);
  await w.s.apply(listenToHearts, actor);
});

Then(
  "the board shows {heartsSeat} took the last trick, that it is {heartsSeat}'s turn and every cumulative score",
  async (w, taker: GameSide, turn: GameSide) => {
    const view = await seesOnce(
      w,
      people(w)[0]!,
      (v) => Object.values(trick(v)).length === 4 && deciding(v) === turn
    );
    expect(view.center).toContain(SEAT_NAMES[taker]);
    expect(deciding(view)).toBe(turn);
    for (const side of SIDES)
      expect(score(view, side)).toBeGreaterThanOrEqual(0);
  }
);
Then(
  '{actor} hears {heartsSeat} took the trick with {heartsCard} and leads next',
  async (w, actor: string, taker: GameSide, card: string) => {
    const heard = await hears(w, actor, [new RegExp(SEAT_NAMES[taker])]);
    expect(heard).toMatch(new RegExp(`${SEAT_NAMES[taker]} took the trick`));
    expect(heard).toMatch(
      new RegExp(`${RANK_NAMES[card[0]!]} of ${SUIT_NAMES[card[1]!]}`, 'i')
    );
    expect(heard).toMatch(/lead/i);
  }
);
Then(
  'the board shows {heartsSeat} has passed and {heartsSeat}, {heartsSeat} and {heartsSeat} have not',
  async (w, passed: GameSide, ...others: GameSide[]) => {
    const view = await seesOnce(w, people(w)[0]!, (v) => hasPassed(v, passed));
    for (const side of others) expect(hasPassed(view, side)).toBe(false);
  }
);
Then(
  '{actor} hears {heartsSeat} has passed',
  async (w, actor: string, side: GameSide) => {
    const heard = await hears(w, actor, [/passed/i]);
    expect(heard).toMatch(new RegExp(`${SEAT_NAMES[side]} has passed`, 'i'));
  }
);
Then(
  "every card in {actor}'s hand shows its rank and suit by symbol and name, not by colour alone",
  async (w, actor: string) => {
    const view = await seesOnce(w, actor, (v) => v.hand.length > 0);
    for (const shown of view.hand) {
      const rank = shown.card[0] === 'T' ? '10' : shown.card[0]!;
      const suit = shown.card[1]!;
      expect(shown.face).toEqual([
        rank,
        SUIT_SYMBOLS[suit] ?? '',
        SUIT_NAMES[suit] ?? '',
      ]);
      expect(shown.label.toLowerCase()).toContain(
        `${RANK_NAMES[shown.card[0]!]} of ${SUIT_NAMES[suit]}`
      );
    }
  }
);
Then(
  'the board names each player and whose turn it is, not by colour alone',
  async (w) => {
    const view = await sees(w, people(w)[0]!);
    for (const side of SIDES) {
      const seat = view.seats[side];
      expect(seat?.name).toStartWith(SEAT_NAMES[side]);
      // A seat still choosing or to play is marked as deciding, in words too.
      const choosing = seat?.facts.includes('Choosing') === true;
      expect(seat?.deciding).toBe(choosing || deciding(view) === side);
    }
    expect(view.center).not.toBe('');
  }
);
