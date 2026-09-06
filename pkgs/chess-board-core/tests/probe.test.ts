import { describe, expect, test } from 'bun:test';
import {
  buildChessBoardProbe,
  chessBoardPanTestId,
  chessBoardProbeTestId,
  chessBoardTapTestId,
  DEFAULT_CHESS_BOARD_TEST_ID,
  parseChessBoardProbe,
} from '@pkgs/chess-board-core/probe';

describe('probe test ids', () => {
  test('derive from the board test id', () => {
    expect(chessBoardPanTestId('b')).toBe('b-pan');
    expect(chessBoardTapTestId('b')).toBe('b-tap');
    expect(chessBoardProbeTestId(DEFAULT_CHESS_BOARD_TEST_ID)).toBe(
      'chess-board-probe'
    );
  });
});

describe('buildChessBoardProbe', () => {
  test('start position: 32 pieces with pixel centers for the orientation', () => {
    const probe = buildChessBoardProbe({ size: 320, orientation: 'white' });
    expect(probe.pieces).toHaveLength(32);
    expect(probe.fen).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );
    const e1 = probe.pieces.find((p) => p.square === 'e1');
    expect(e1).toEqual({ square: 'e1', piece: 'wk', x: 180, y: 300 });
  });

  test('black orientation flips the board', () => {
    const probe = buildChessBoardProbe({ size: 320, orientation: 'black' });
    const e1 = probe.pieces.find((p) => p.square === 'e1');
    expect(e1).toEqual({ square: 'e1', piece: 'wk', x: 140, y: 20 });
  });

  test('custom FEN is honoured and empty FEN falls back to start', () => {
    const probe = buildChessBoardProbe({
      fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      size: 80,
      orientation: 'white',
    });
    expect(probe.pieces.map((p) => p.square).sort()).toEqual(['e1', 'e8']);
    expect(
      buildChessBoardProbe({ fen: '', size: 80, orientation: 'white' }).pieces
    ).toHaveLength(32);
  });
});

describe('parseChessBoardProbe', () => {
  test('round-trips a built probe', () => {
    const probe = buildChessBoardProbe({ size: 160, orientation: 'white' });
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
