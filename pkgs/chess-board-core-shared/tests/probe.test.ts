import { describe, expect, test } from 'bun:test';
import type { ChessBoardProbeInteraction } from '@pkgs/chess-board-core-shared/probe';
import {
  buildChessBoardProbe,
  chessBoardPaintToken,
  chessBoardProbeTestId,
  chessBoardSquareTestId,
  DEFAULT_CHESS_BOARD_TEST_ID,
  parseChessBoardPaint,
  parseChessBoardProbe,
} from '@pkgs/chess-board-core-shared/probe';

const IDLE: ChessBoardProbeInteraction = {
  interactive: true,
  selected: null,
  legalTargets: [],
  lastMove: null,
  promotion: null,
  premoves: [],
  cursor: 'a1',
};

describe('probe test ids', () => {
  test('derive from the board test id', () => {
    expect(chessBoardSquareTestId('b', 'e4')).toBe('b-square-e4');
    expect(chessBoardProbeTestId(DEFAULT_CHESS_BOARD_TEST_ID)).toBe(
      'chess-board-probe'
    );
  });
});

describe('buildChessBoardProbe', () => {
  test('start position: 32 pieces with pixel centers for the orientation', () => {
    const probe = buildChessBoardProbe({
      size: 320,
      orientation: 'white',
      interaction: IDLE,
    });
    expect(probe.pieces).toHaveLength(32);
    expect(probe.fen).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );
    const e1 = probe.pieces.find((p) => p.square === 'e1');
    expect(e1).toEqual({ square: 'e1', piece: 'wk', x: 180, y: 300 });
  });

  test('black orientation flips the board', () => {
    const probe = buildChessBoardProbe({
      size: 320,
      orientation: 'black',
      interaction: IDLE,
    });
    const e1 = probe.pieces.find((p) => p.square === 'e1');
    expect(e1).toEqual({ square: 'e1', piece: 'wk', x: 140, y: 20 });
  });

  test('custom FEN is honoured and empty FEN falls back to start', () => {
    const probe = buildChessBoardProbe({
      fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      size: 80,
      orientation: 'white',
      interaction: IDLE,
    });
    expect(probe.pieces.map((p) => p.square).sort()).toEqual(['e1', 'e8']);
    expect(
      buildChessBoardProbe({
        fen: '',
        size: 80,
        orientation: 'white',
        interaction: IDLE,
      }).pieces
    ).toHaveLength(32);
  });
});

describe('parseChessBoardProbe', () => {
  test('round-trips a built probe', () => {
    const probe = buildChessBoardProbe({
      size: 160,
      orientation: 'white',
      interaction: IDLE,
    });
    expect(parseChessBoardProbe(JSON.stringify(probe))).toEqual(probe);
  });

  test('rejects empty or malformed text', () => {
    expect(() => parseChessBoardProbe(null)).toThrow('empty text');
    expect(() => parseChessBoardProbe('')).toThrow('empty text');
    expect(() =>
      parseChessBoardProbe(JSON.stringify({ size: 1, orientation: 'up' }))
    ).toThrow('invalid shape');
  });
});

describe('probe status', () => {
  test('reports turn, check and terminal status from the FEN', () => {
    const mate = buildChessBoardProbe({
      fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
      size: 80,
      orientation: 'white',
      interaction: { ...IDLE, legalTargets: ['e4', 'a3'] },
    });
    expect(mate).toMatchObject({
      turn: 'w',
      inCheck: true,
      status: 'checkmate',
      legalTargets: ['a3', 'e4'],
    });
    const stalemate = buildChessBoardProbe({
      fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
      size: 80,
      orientation: 'white',
      interaction: IDLE,
    });
    expect(stalemate).toMatchObject({ inCheck: false, status: 'stalemate' });
  });
});

describe('paint tokens', () => {
  test('round-trip through layer text, ignoring other text', () => {
    const text = [
      'a',
      chessBoardPaintToken({ kind: 'piece', detail: 'wp', at: 'e4' }),
      '1',
      chessBoardPaintToken({ kind: 'dot', at: 'e3' }),
    ].join('');
    expect(parseChessBoardPaint(text)).toEqual(['dot@e3', 'piece:wp@e4']);
    expect(parseChessBoardPaint(null)).toEqual([]);
  });
});
