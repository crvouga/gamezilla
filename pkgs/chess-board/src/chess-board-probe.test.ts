import { describe, expect, test } from 'bun:test';

import {
  buildChessBoardProbe,
  chessBoardPanTestId,
  chessBoardProbeTestId,
  chessBoardTapTestId,
  parseChessBoardProbe,
} from './chess-board-probe';

describe('chess-board-probe', () => {
  test('gesture / probe ids derive from board testID', () => {
    expect(chessBoardPanTestId('chess-puzzle-board')).toBe(
      'chess-puzzle-board-pan'
    );
    expect(chessBoardTapTestId('chess-puzzle-board')).toBe(
      'chess-puzzle-board-tap'
    );
    expect(chessBoardProbeTestId('chess-puzzle-board')).toBe(
      'chess-puzzle-board-probe'
    );
  });

  test('buildChessBoardProbe places white pawn at e2 for start fen', () => {
    const probe = buildChessBoardProbe({
      size: 320,
      orientation: 'white',
    });
    expect(probe.size).toBe(320);
    const e2 = probe.pieces.find((p) => p.square === 'e2');
    expect(e2?.piece).toBe('wp');
    expect(e2?.x).toBeCloseTo(180, 5);
    expect(e2?.y).toBeCloseTo(260, 5);
  });

  test('parseChessBoardProbe round-trips JSON', () => {
    const probe = buildChessBoardProbe({ size: 160, orientation: 'black' });
    const again = parseChessBoardProbe(JSON.stringify(probe));
    expect(again.orientation).toBe('black');
    expect(again.size).toBe(160);
    expect(again.pieces.length).toBe(probe.pieces.length);
  });
});
