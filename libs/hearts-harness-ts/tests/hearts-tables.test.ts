import { expect, test } from 'bun:test';
import { KNOWN_HIDDEN } from '@libs/hearts-harness-ts/hearts-known-match';
import {
  awaitingPassesIn,
  fourthDealStarted,
  secondDealFirstTrick,
  southVictory,
  thirdDealLastCard,
} from '@libs/hearts-harness-ts/hearts-later-deals';
import {
  type HeartsLine,
  heartsHandAfter,
  heartsReached,
} from '@libs/hearts-harness-ts/hearts-lines';
import * as tables from '@libs/hearts-harness-ts/hearts-tables';
import { seatToPlay } from '@libs/hearts-shared-ts/hearts-tricks';

const TABLES = Object.entries(tables).flatMap(([name, value]) =>
  typeof value === 'object' && value !== null && 'stages' in value
    ? [[name, value as tables.HeartsTable] as const]
    : []
);

function hand(line: HeartsLine, side: 'white' | 'black' | 'red' | 'blue') {
  return heartsHandAfter(line, side).match(/../g) ?? [];
}

test('every stage of every table is a legal line', () => {
  expect(TABLES.length).toBeGreaterThan(10);
  for (const [, table] of TABLES)
    for (const stage of Object.keys(table.stages))
      expect(() => heartsReached(tables.lineAt(table, stage))).not.toThrow();
});

test('the hand-written tables give each scenario the hands it names', () => {
  const trick = tables.lineAt(tables.TRICK_TABLE, 'passed');
  expect(hand(trick, 'white')).toContain('2C');
  expect(hand(trick, 'black').filter((card) => card[1] === 'C')).toEqual([
    '9C',
  ]);
  expect(hand(trick, 'black')).toContain('AD');
  expect(hand(trick, 'black')).not.toContain('AS');
  const voidWest = tables.lineAt(tables.WEST_VOID_TABLE, 'south led');
  expect(hand(voidWest, 'black').filter((card) => card[1] === 'C')).toEqual([]);
  const heartsWest = tables.lineAt(tables.WEST_HEARTS_TABLE, 'south led');
  expect(hand(heartsWest, 'black').filter((card) => card[1] !== 'H')).toEqual([
    'QS',
  ]);
  const onlyHearts = tables.lineAt(
    tables.SOUTH_HEARTS_TABLE,
    'south leads fifth'
  );
  expect(new Set(hand(onlyHearts, 'white').map((card) => card[1]))).toEqual(
    new Set(['H'])
  );
});

test('each scoring table ends its deal with the scores its scenario names', () => {
  const ended = (table: tables.HeartsTable, last: string) => {
    const line = tables.lineAt(table, 'last card');
    return heartsReached({ ...line, history: [...line.history, last] }).position
      .scores;
  };
  expect(ended(tables.SOUTH_SIXTEEN_TABLE, 'AH')).toEqual([16, 0, 10, 0]);
  expect(ended(tables.NORTH_MOON_TABLE, 'AS')).toEqual([26, 26, 0, 26]);
  expect(ended(tables.NORTH_TWENTY_FIVE_TABLE, '2H')).toEqual([0, 0, 25, 1]);
});

test('the frozen seeds reach the later deals their scenarios name', () => {
  for (const deal of [1, 2, 3, 5]) {
    const line = awaitingPassesIn(deal);
    const at = heartsReached(line).position;
    expect([at.deal, at.phase]).toEqual([deal, 'pass']);
    expect(hand(line, 'white')).toEqual(
      expect.arrayContaining(['AS', 'KS', 'QS'])
    );
    expect(hand(line, 'blue')).toEqual(
      expect.arrayContaining(['2D', '3D', '4D'])
    );
  }
  const fourth = fourthDealStarted();
  expect(heartsReached(fourth).position.deal).toBe(4);
  expect(hand(fourth, 'white')).toEqual(
    expect.arrayContaining(['AS', 'KS', 'QS'])
  );
  const third = heartsReached(thirdDealLastCard()).position;
  expect([third.deal, third.plays.length, seatToPlay(third)]).toEqual([
    3, 51, 3,
  ]);
  for (const score of third.scores) expect(score).toBeLessThan(50);
  const second = heartsReached(secondDealFirstTrick()).position;
  expect([second.deal, second.plays.length]).toEqual([2, 4]);
});

test('the known deal is the one its known draws deal, and South wins it alone', () => {
  const victory = southVictory();
  expect(heartsReached({ ...victory, history: [] }).hidden).toBe(KNOWN_HIDDEN);
  const over = heartsReached(victory).position;
  expect(over.phase).toBe('done');
  const south = over.scores[0] ?? -1;
  expect(Math.min(...over.scores)).toBe(south);
  expect(over.scores.filter((score) => score === south)).toHaveLength(1);
});
