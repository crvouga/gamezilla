import { describe, expect, test } from 'bun:test';
import {
  decodeHearts,
  encodeHearts,
  passDirection,
  passTarget,
} from '@libs/hearts-shared-ts/hearts-position';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import {
  cardsOf,
  holdDealStart,
  SUITS_DEAL,
  SUITS_HANDS,
  suitsDealPlays,
} from './hearts-deals';
import { finished, handOf, newTable, pass, play, turn } from './hearts-table';

const hands = heartsRules.hands!;
/** What the seat to play may play, knowing only its own cards. */
const legal = (position: string, _side: string, hand: string) =>
  hands.proposals(position, hand);

/** A table at the fourth deal (no passing) with the suits deal and `scores`. */
function holdTable(scores: readonly number[]) {
  return newTable(SUITS_DEAL, holdDealStart(scores));
}

describe('passing', () => {
  test('passing repeats left, right, across and hold by deal', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(passDirection)).toEqual([
      'left',
      'right',
      'across',
      'hold',
      'left',
      'right',
      'across',
      'hold',
    ]);
    expect([0, 1, 2, 3].map((seat) => passTarget(seat as 0, 1))).toEqual([
      1, 2, 3, 0,
    ]);
    expect([0, 1, 2, 3].map((seat) => passTarget(seat as 0, 2))).toEqual([
      3, 0, 1, 2,
    ]);
    expect([0, 1, 2, 3].map((seat) => passTarget(seat as 0, 3))).toEqual([
      2, 3, 0, 1,
    ]);
  });

  test('every side passes three distinct cards of its own hand, once', () => {
    const table = newTable(SUITS_DEAL);
    expect(pass(table, 'white', '2C3C')).toBe(false);
    expect(pass(table, 'white', '2C2C3C')).toBe(false);
    expect(pass(table, 'white', '2C3C2D')).toBe(false);
    expect(pass(table, 'white', '4C3C2C')).toBe(true);
    expect(table.commitments.white).toBe('2C3C4C');
    expect(pass(table, 'white', '5C6C7C')).toBe(false);
    expect(play(table, '2C')).toBe(false);
    expect(table.actions).toEqual([]);
  });

  test('the cards change hands at once after the fourth pass, and the two of clubs leads', () => {
    const table = newTable(SUITS_DEAL);
    pass(table, 'white', 'AC2C3C');
    pass(table, 'black', '2D3D4D');
    pass(table, 'red', 'QSKSAS');
    expect(table.actions).toEqual([]);
    pass(table, 'blue', '2H3H4H');
    // Passing left: South to West, West to North, North to East, East to South.
    expect(table.actions).toEqual(['pass:black']);
    expect(handOf(table, 'black')).toContain('2C');
    expect(handOf(table, 'white')).toContain('2H');
    expect(handOf(table, 'blue')).toContain('QS');
    expect(handOf(table, 'red')).toContain('2D');
    expect(handOf(table, 'white')).not.toContain('AC');
    expect(turn(table)).toBe('black');
    expect(table.steps.at(-1)?.label).toBe('Cards passed left');
  });

  test('a deal without passing starts with the two of clubs at once', () => {
    const table = holdTable([0, 0, 0, 0]);
    expect(hands.commit!.sides(table.position)).toEqual([]);
    expect(pass(table, 'white', '2C3C4C')).toBe(false);
    expect(play(table, '2C')).toBe(true);
  });
});

describe('playing cards', () => {
  test('the two of clubs leads the first trick', () => {
    const position = holdDealStart([0, 0, 0, 0]);
    expect(legal(position, 'white', SUITS_HANDS.white)).toEqual(['2C']);
    const table = holdTable([0, 0, 0, 0]);
    expect(play(table, '3C')).toBe(false);
    expect(play(table, '2C')).toBe(true);
  });

  test('a player follows the led suit when they can', () => {
    const position = encodeHearts({
      ...decodeHearts(holdDealStart([0, 0, 0, 0]))!,
      plays: ['2C'],
    });
    const hand = [...cardsOf('C', '3K'), ...cardsOf('H', 'A')].join('');
    expect(legal(position, 'black', hand)).toEqual(cardsOf('C', '3K'));
  });

  test('the first trick holds back hearts and the queen of spades unless nothing else is left', () => {
    const position = encodeHearts({
      ...decodeHearts(holdDealStart([0, 0, 0, 0]))!,
      plays: ['2C'],
    });
    const mixed = [...cardsOf('D', '23'), ...cardsOf('H', 'AK'), 'QS'].join('');
    expect(legal(position, 'black', mixed)).toEqual(['2D', '3D']);
    const pointsOnly = [...cardsOf('H', '23456789TJQK'), 'QS'].join('');
    expect(legal(position, 'black', pointsOnly)).toHaveLength(13);
  });

  test('hearts are led only once broken, unless only hearts remain, and the queen of spades alone does not break them', () => {
    const afterQueen = encodeHearts({
      ...decodeHearts(holdDealStart([0, 0, 0, 0]))!,
      plays: ['2C', '3C', 'QS', '4C'],
    });
    // West's three, North's queen and East's four follow South's two: East's club wins.
    const leader = heartsRules.play(
      encodeHearts({
        ...decodeHearts(holdDealStart([0, 0, 0, 0]))!,
        plays: ['2C', '3C', 'QS'],
      }),
      '4C',
      '',
      []
    )?.turn;
    expect(leader).toBe('blue');
    const hand = [...cardsOf('H', 'AK'), ...cardsOf('D', '5')].join('');
    expect(legal(afterQueen, 'blue', hand)).toEqual(['5D']);
    expect(legal(afterQueen, 'blue', cardsOf('H', 'KA').join(''))).toEqual([
      'KH',
      'AH',
    ]);
  });

  test('the highest card of the led suit wins and its player leads next', () => {
    const table = holdTable([0, 0, 0, 0]);
    for (const card of ['2C', '2D', '2S', '2H'])
      expect(play(table, card)).toBe(true);
    expect(turn(table)).toBe('white');
    expect(play(table, '2D')).toBe(false);
  });
});

describe('scoring and the match', () => {
  test('taking all twenty-six points shoots the moon: zero for the shooter, twenty-six for each other', () => {
    const table = holdTable([0, 0, 0, 0]);
    for (const card of suitsDealPlays().slice(0, -1)) play(table, card);
    // The deal's last card is public only with what follows it: the next,
    // passing, deal the authority deals at once.
    expect(heartsRules.play(table.position, 'AH', '', [])).toBeNull();
    expect(play(table, 'AH')).toBe(true);
    expect(table.actions.at(-1)).toBe('AH+deal');
    expect(decodeHearts(table.position)).toMatchObject({
      deal: 5,
      phase: 'pass',
      scores: [0, 26, 26, 26],
      last: [0, 26, 26, 26],
    });
  });

  test('the match ends at the end of a deal once a score reaches 100, and the lowest score wins', () => {
    const table = holdTable([0, 74, 80, 99]);
    for (const card of suitsDealPlays()) expect(play(table, card)).toBe(true);
    expect(finished(table)).toBe(true);
    expect(table.steps.at(-1)).toMatchObject({
      winner: 'white',
      reason: 'lowest score',
    });
    expect(decodeHearts(table.position)?.scores).toEqual([0, 100, 106, 125]);
  });

  test('tied lowest scores are joint winners', () => {
    const table = holdTable([50, 24, 80, 99]);
    for (const card of suitsDealPlays()) play(table, card);
    expect(table.steps.at(-1)?.winner).toEqual(['white', 'black']);
  });

  test('a finished match accepts no further play or passing', () => {
    const table = holdTable([0, 74, 80, 99]);
    for (const card of suitsDealPlays()) play(table, card);
    const done = table.position;
    expect(heartsRules.legal(done)).toEqual([]);
    expect(hands.commit!.sides(done)).toEqual([]);
    expect(heartsRules.play(done, 'pass:white', '', [])).toBeNull();
    expect(heartsRules.play(done, '2C', '', [])).toBeNull();
    expect(hands.resolve(done, '2C', SUITS_DEAL)).toHaveProperty('refusal');
  });

  test('the next deal keeps the cumulative scores and the passing cycle', () => {
    const table = holdTable([10, 20, 30, 40]);
    for (const card of suitsDealPlays().slice(0, -1)) play(table, card);
    expect(play(table, 'AH')).toBe(true);
    expect(table.actions.at(-1)).toBe('AH+deal');
    expect(decodeHearts(table.position)).toMatchObject({
      deal: 5,
      phase: 'pass',
      scores: [10, 46, 56, 66],
      plays: [],
    });
    expect(hands.commit!.sides(table.position)).toHaveLength(4);
    for (const side of ['white', 'black', 'red', 'blue'] as const)
      expect(handOf(table, side)).toHaveLength(26);
  });
});
