import { expect, test } from 'bun:test';
import { mountBoard } from './board-fixture';

// regression: chess-puzzle-outline-covers-piece
test('the occupied f3 hint frames the perimeter in either orientation without a central badge', () => {
  for (const orientation of ['white', 'black'] as const) {
    const board = mountBoard({
      fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
      orientation,
      cellFeedback: {
        f3: { kind: 'dot', shape: 'outline', label: 'Hint: move this piece' },
      },
    });
    const layer = board.host.querySelector(
      '[data-testid="fixture-board-layer-feedback"]'
    );
    expect(layer).not.toBeNull();
    const rings = layer?.querySelectorAll('rect');
    expect(rings?.length).toBe(2);
    for (const ring of rings ?? []) {
      expect(ring.getAttribute('fill')).toBe('none');
      expect(ring.getAttribute('width')).toBe('92');
      expect(ring.getAttribute('x')).toBe(
        orientation === 'white' ? '504' : '204'
      );
      expect(ring.getAttribute('y')).toBe(
        orientation === 'white' ? '504' : '204'
      );
    }
    expect(layer?.querySelector('circle')).toBeNull();
    expect(board.piece('f3')).toBeTruthy();
    board.unmount();
  }
});
