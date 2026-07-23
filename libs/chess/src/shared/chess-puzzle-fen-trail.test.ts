import { describe, expect, test } from 'bun:test';

import { setupPuzzleStart } from './chess-puzzle-fsm';
import { buildPuzzleFenTrail } from './chess-puzzle-fen-trail';

const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
const VALID_MOVES = 'e8d7 e1f2 d7e7';

describe('buildPuzzleFenTrail', () => {
  test('returns empty for empty fen/moves or throughIdx 0', () => {
    expect(
      buildPuzzleFenTrail({ fen: '', moves: VALID_MOVES, throughIdx: 1 })
    ).toEqual([]);
    expect(
      buildPuzzleFenTrail({ fen: VALID_FEN, moves: '', throughIdx: 1 })
    ).toEqual([]);
    expect(
      buildPuzzleFenTrail({ fen: VALID_FEN, moves: VALID_MOVES, throughIdx: 0 })
    ).toEqual([]);
  });

  test('index 0 is post-opening FEN (after token 0)', () => {
    const setup = setupPuzzleStart(VALID_FEN, VALID_MOVES);
    expect(setup.kind).toBe('ready');
    if (setup.kind !== 'ready') return;

    const trail = buildPuzzleFenTrail({
      fen: VALID_FEN,
      moves: VALID_MOVES,
      throughIdx: 1,
    });
    expect(trail).toHaveLength(1);
    expect(trail[0]).toBe(setup.displayFen);
  });

  test('throughIdx matches solveIdx frontier length', () => {
    const trail = buildPuzzleFenTrail({
      fen: VALID_FEN,
      moves: VALID_MOVES,
      throughIdx: 3,
    });
    expect(trail).toHaveLength(3);
    expect(trail[0]).not.toBe(trail[1]);
    expect(trail[1]).not.toBe(trail[2]);
  });

  test('caps at token count', () => {
    const trail = buildPuzzleFenTrail({
      fen: VALID_FEN,
      moves: VALID_MOVES,
      throughIdx: 99,
    });
    expect(trail).toHaveLength(3);
  });
});
