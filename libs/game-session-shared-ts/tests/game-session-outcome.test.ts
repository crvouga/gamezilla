import { expect, test } from 'bun:test';
import {
  gameSessionOutcome,
  gameSessionOutcomeReason,
  gameSessionWinners,
} from '@libs/game-session-shared-ts/game-session-outcome';

const FOUR = ['white', 'black', 'red', 'blue'] as const;
const TWO = ['white', 'black'] as const;

test('a single winner keeps the outcome every two-seat game already stores', () => {
  expect(gameSessionOutcome('black', 'checkmate', TWO)).toBe(
    'black wins by checkmate'
  );
  expect(gameSessionOutcome(['white'], 'connection', TWO)).toBe(
    'white wins by connection'
  );
  expect(gameSessionOutcome('draw', 'stalemate', TWO)).toBe('draw');
});

test('joint winners are named in seat order, and every seat sharing it is a draw', () => {
  expect(gameSessionOutcome(['red', 'white'], 'lowest score', FOUR)).toBe(
    'white and red win by lowest score'
  );
  expect(
    gameSessionOutcome(['blue', 'black', 'white'], 'lowest score', FOUR)
  ).toBe('white, black and blue win by lowest score');
  expect(gameSessionOutcome([...FOUR], 'lowest score', FOUR)).toBe('draw');
});

test('the winners of a stored outcome: one, several, all for a draw, none otherwise', () => {
  const finished = (outcome: string) => ({
    status: 'completed' as const,
    outcome,
    sides: [...FOUR],
  });
  expect(gameSessionWinners(finished('red wins by lowest score'))).toEqual([
    'red',
  ]);
  expect(
    gameSessionWinners(finished('white, black and blue win by lowest score'))
  ).toEqual(['white', 'black', 'blue']);
  expect(gameSessionWinners(finished('draw'))).toEqual(FOUR);
  expect(gameSessionWinners(finished('white wins on time'))).toEqual(['white']);
  expect(
    gameSessionWinners(finished('black wins because white stayed away'))
  ).toEqual(['black']);
  expect(
    gameSessionWinners({
      status: 'cancelled',
      outcome: 'cancelled',
      sides: [...FOUR],
    })
  ).toEqual([]);
  expect(
    gameSessionWinners({ status: 'active', outcome: '', sides: [...FOUR] })
  ).toEqual([]);
});

test('the ending reason a won outcome names', () => {
  expect(gameSessionOutcomeReason('white and red win by lowest score')).toBe(
    'lowest score'
  );
  expect(gameSessionOutcomeReason('black wins by checkmate')).toBe('checkmate');
  expect(gameSessionOutcomeReason('draw')).toBe('');
});
