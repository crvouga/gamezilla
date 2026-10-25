import { describe, expect, test } from 'bun:test';
import {
  dailyClockParts,
  dailyClockStepMs,
  moveListText,
  multiplayerMoves,
  positionAfter,
} from '@libs/game-matchmaking-client-ts/multiplayer-format';
import {
  createTurnGames,
  type GameRules,
  type GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("a daily game's clock in the units people plan by", () => {
  test('whole days read as days alone', () => {
    expect(dailyClockParts(3 * DAY)).toEqual({
      unit: 'days',
      days: 3,
      hours: 0,
    });
    expect(dailyClockParts(2 * DAY)).toEqual({
      unit: 'days',
      days: 2,
      hours: 0,
    });
  });

  test('a day or more reads as days and hours, rounded up', () => {
    expect(dailyClockParts(2 * DAY + 5 * HOUR)).toEqual({
      unit: 'days',
      days: 2,
      hours: 5,
    });
    expect(dailyClockParts(2 * DAY + 4 * HOUR + 1)).toEqual({
      unit: 'days',
      days: 2,
      hours: 5,
    });
    expect(dailyClockParts(DAY)).toEqual({ unit: 'days', days: 1, hours: 0 });
  });

  test('under a day reads as hours and minutes, rounded up', () => {
    expect(dailyClockParts(5 * HOUR + 12 * MINUTE)).toEqual({
      unit: 'hours',
      hours: 5,
      minutes: 12,
    });
    expect(dailyClockParts(DAY - MINUTE)).toEqual({
      unit: 'hours',
      hours: 23,
      minutes: 59,
    });
    expect(dailyClockParts(DAY - 1)).toEqual({
      unit: 'days',
      days: 1,
      hours: 0,
    });
    expect(dailyClockParts(HOUR)).toEqual({
      unit: 'hours',
      hours: 1,
      minutes: 0,
    });
  });

  test('under an hour hands over to the ordinary clock, never below zero', () => {
    expect(dailyClockParts(HOUR - MINUTE)).toEqual({
      unit: 'seconds',
      ms: HOUR - MINUTE,
    });
    expect(dailyClockParts(-5)).toEqual({ unit: 'seconds', ms: 0 });
  });

  test('the clock next reads differently when its smallest unit turns over', () => {
    expect(dailyClockStepMs(3 * DAY)).toBe(HOUR);
    expect(dailyClockStepMs(2 * DAY + 30 * MINUTE)).toBe(30 * MINUTE);
    expect(dailyClockStepMs(5 * HOUR + 30_000)).toBe(30_000);
    expect(dailyClockStepMs(90_500)).toBe(500);
  });
});

const MOVE_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RECORDED_GAME = { fen: 'reference:8', pgn: '' };

function recordedRules(sides: readonly GameSide[]) {
  const rules: GameRules = {
    id: 'reference',
    sides,
    initial: () => 'reference:0',
    recognizes: (position) => position.startsWith('reference:'),
    legal: () => [],
    play: () => null,
    replay: (_actions, ply) => `reference:${ply}`,
    canWin: () => true,
    moves: () =>
      MOVE_LABELS.map((label, index) => ({
        label,
        before: `reference:${index}`,
        after: `reference:${index + 1}`,
      })),
  };
  return createTurnGames([{ rules, capabilities: {} }]);
}

describe('move numbering follows the declared seats', () => {
  // regression: multiseat-move-numbering
  test('four seats each have an unambiguous round and seat ordinal', () => {
    const rules = recordedRules(['white', 'black', 'red', 'blue']);
    const moves = multiplayerMoves(RECORDED_GAME, rules);
    expect(moves.map((move) => move.numbering)).toEqual([
      '1.1.',
      '1.2.',
      '1.3.',
      '1.4.',
      '2.1.',
      '2.2.',
      '2.3.',
      '2.4.',
    ]);
    expect(moves.map((move) => move.name)).toEqual([
      '1.1. a',
      '1.2. b',
      '1.3. c',
      '1.4. d',
      '2.1. e',
      '2.2. f',
      '2.3. g',
      '2.4. h',
    ]);
    expect(moveListText(RECORDED_GAME, rules)).toBe(
      '1.1. a 1.2. b 1.3. c 1.4. d 2.1. e 2.2. f 2.3. g 2.4. h'
    );
    expect(positionAfter(moves, 4)).toBe('reference:4');
  });

  test('two seats retain their existing displayed and spoken notation', () => {
    const rules = recordedRules(['white', 'black']);
    const moves = multiplayerMoves(RECORDED_GAME, rules);
    expect(moves.map((move) => move.numbering)).toEqual([
      '1.',
      '',
      '2.',
      '',
      '3.',
      '',
      '4.',
      '',
    ]);
    expect(moves.map((move) => move.name)).toEqual([
      '1. a',
      '1... b',
      '2. c',
      '2... d',
      '3. e',
      '3... f',
      '4. g',
      '4... h',
    ]);
    expect(moveListText(RECORDED_GAME, rules)).toBe(
      '1. a b 2. c d 3. e f 4. g h'
    );
  });
});
