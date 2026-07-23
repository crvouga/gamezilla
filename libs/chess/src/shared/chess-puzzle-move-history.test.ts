import { describe, expect, test } from 'bun:test';

import { setupPuzzleStart } from './chess-puzzle-fsm';
import { buildPuzzleMoveHistory } from './chess-puzzle-move-history';

const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
const VALID_MOVES = 'e8d7 e1f2 d7e7';

describe('buildPuzzleMoveHistory', () => {
  test('returns empty for empty fen/moves or throughIdx 0', () => {
    expect(
      buildPuzzleMoveHistory({ fen: '', moves: VALID_MOVES, throughIdx: 1 })
    ).toEqual([]);
    expect(
      buildPuzzleMoveHistory({ fen: VALID_FEN, moves: '', throughIdx: 1 })
    ).toEqual([]);
    expect(
      buildPuzzleMoveHistory({
        fen: VALID_FEN,
        moves: VALID_MOVES,
        throughIdx: 0,
      })
    ).toEqual([]);
  });

  test('opening ply is black SAN after token 0', () => {
    const setup = setupPuzzleStart(VALID_FEN, VALID_MOVES);
    expect(setup.kind).toBe('ready');
    const plies = buildPuzzleMoveHistory({
      fen: VALID_FEN,
      moves: VALID_MOVES,
      throughIdx: 1,
    });
    expect(plies).toHaveLength(1);
    expect(plies[0]).toMatchObject({
      plyIndex: 0,
      solveIdxAfter: 1,
      color: 'b',
      san: 'Kd7',
      moveNumber: 1,
    });
  });

  test('throughIdx builds paired SAN with move numbers', () => {
    const plies = buildPuzzleMoveHistory({
      fen: VALID_FEN,
      moves: VALID_MOVES,
      throughIdx: 3,
    });
    expect(plies).toHaveLength(3);
    expect(plies.map((p) => p.san)).toEqual(['Kd7', 'Kf2', 'Ke7']);
    expect(plies[1]?.color).toBe('w');
    expect(plies[1]?.moveNumber).toBe(2);
    expect(plies[2]?.color).toBe('b');
    expect(plies[2]?.moveNumber).toBe(2);
  });
});
