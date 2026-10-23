import { expect, test } from 'bun:test';
import {
  decodeQuoridor,
  encodeQuoridor,
  legalQuoridorActions,
  newQuoridor,
  pawnMoves,
  playQuoridor,
  replayQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { chooseQuoridorAction } from '@libs/quoridor-shared-ts/quoridor-bot';

test('a bot places a legal wall when its pawn is temporarily boxed in by pawns', () => {
  // regression: quoridor-bot-blocked-pawn
  const game = {
    ...newQuoridor('hill'),
    pawns: [13, 22, 31, 44],
    walls: ['d2v', 'e2v', 'd1h'],
    remaining: [4, 4, 4, 5],
  };
  expect(pawnMoves(game)).toEqual([]);
  const legal = legalQuoridorActions(game);
  expect(legal.length).toBeGreaterThan(0);
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const selected = chooseQuoridorAction(game, difficulty, () => 0.25);
    expect(selected).not.toBeNull();
    if (selected === null)
      throw new Error('A legal wall must keep the bot moving');
    expect(legal).toContain(selected);
    expect(playQuoridor(game, selected)?.turn).toBe(1);
  }
});

test('only an immobile hill player without a legal wall may pass', () => {
  const game = replayQuoridor('hill', [
    'e2',
    'a4',
    'e8',
    'i6',
    'e1',
    'b4',
    'e7',
    'i5',
    'e2',
    'c4',
    'f7',
    'i6',
    'a1h',
    'd4',
    'f6',
    'i5',
    'c7h',
    'd3',
    'f5',
    'a3h',
    'f7h',
    'e3',
    'f4',
    'c5h',
    'a7v',
    'd2v',
    'e4',
    'g3h',
    'g1h',
    'e2v',
    'd1h',
    'a5v',
  ]);
  expect(game.pawns).toEqual([13, 22, 31, 44]);
  expect(game.remaining).toEqual([0, 3, 4, 1]);
  expect(legalQuoridorActions(game)).toEqual(['pass']);
  const next = playQuoridor(game, 'pass')!;
  expect(next?.turn).toBe(1);
  expect(next?.pawns).toEqual(game.pawns);
  expect(next?.remaining).toEqual(game.remaining);
  expect(next?.walls).toEqual(game.walls);
  expect(next.actions).toEqual([...game.actions, 'pass']);
  expect(decodeQuoridor(encodeQuoridor(next))).toEqual(next);
  for (const difficulty of ['easy', 'medium', 'hard'] as const)
    expect(chooseQuoridorAction(game, difficulty, () => 0)).toBe('pass');
  expect(playQuoridor(newQuoridor('hill'), 'pass')).toBeNull();
  expect(playQuoridor(newQuoridor('classic'), 'pass')).toBeNull();
});
