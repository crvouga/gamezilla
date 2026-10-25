import { expect, test } from 'bun:test';
import {
  customGameOutcome,
  customGameOutcomeReason,
  customGameWinners,
} from '@libs/game-session-shared-ts/custom-game-outcome';

const FOUR = ['white', 'black', 'red', 'blue'] as const;
const TWO = ['white', 'black'] as const;

test('a single winner keeps the outcome every two-seat game already stores', () => {
  expect(customGameOutcome('black', 'checkmate', TWO)).toBe(
    'black wins by checkmate'
  );
  expect(customGameOutcome(['white'], 'connection', TWO)).toBe(
    'white wins by connection'
  );
  expect(customGameOutcome('draw', 'stalemate', TWO)).toBe('draw');
});

test('joint winners are named in seat order, and every seat sharing it is a draw', () => {
  expect(customGameOutcome(['red', 'white'], 'lowest score', FOUR)).toBe(
    'white and red win by lowest score'
  );
  expect(
    customGameOutcome(['blue', 'black', 'white'], 'lowest score', FOUR)
  ).toBe('white, black and blue win by lowest score');
  expect(customGameOutcome([...FOUR], 'lowest score', FOUR)).toBe('draw');
});

test('the winners of a stored outcome: one, several, all for a draw, none otherwise', () => {
  const finished = (outcome: string) => ({
    status: 'completed' as const,
    outcome,
    sides: [...FOUR],
  });
  expect(customGameWinners(finished('red wins by lowest score'))).toEqual([
    'red',
  ]);
  expect(
    customGameWinners(finished('white, black and blue win by lowest score'))
  ).toEqual(['white', 'black', 'blue']);
  expect(customGameWinners(finished('draw'))).toEqual(FOUR);
  expect(customGameWinners(finished('white wins on time'))).toEqual(['white']);
  expect(
    customGameWinners(finished('black wins because white stayed away'))
  ).toEqual(['black']);
  expect(
    customGameWinners({
      status: 'cancelled',
      outcome: 'cancelled',
      sides: [...FOUR],
    })
  ).toEqual([]);
  expect(
    customGameWinners({ status: 'active', outcome: '', sides: [...FOUR] })
  ).toEqual([]);
});

test('the ending reason a won outcome names', () => {
  expect(customGameOutcomeReason('white and red win by lowest score')).toBe(
    'lowest score'
  );
  expect(customGameOutcomeReason('black wins by checkmate')).toBe('checkmate');
  expect(customGameOutcomeReason('draw')).toBe('');
});
