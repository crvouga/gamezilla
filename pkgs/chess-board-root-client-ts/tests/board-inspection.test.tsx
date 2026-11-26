import { expect, test } from 'bun:test';
import { flush } from 'solid-js';
import { mountBoard } from './board-fixture';

test('a finger can hold an empty square to inspect, pan to a bound and tap a transformed piece', () => {
  const board = mountBoard();
  try {
    const viewport = board.host.closest<HTMLElement>('[data-chess-inspection]');
    if (!viewport) throw new Error('Missing inspection viewport');
    viewport.getBoundingClientRect = board.host.getBoundingClientRect;
    const touch = { pointerType: 'touch' } as const;
    board.down({ ...touch, square: 'e4' });
    board.clock.advance(550);
    board.up({ ...touch, square: 'e4' });
    flush();
    expect(viewport.dataset['chessInspection']).toBe('magnified');
    board.down({ ...touch, at: { x: 200, y: 200 } });
    board.move({ ...touch, at: { x: 900, y: 900 } });
    board.up({ ...touch, at: { x: 900, y: 900 } });
    board.down({ ...touch, at: { x: 40, y: 40 } });
    board.up({ ...touch, at: { x: 40, y: 40 } });
    flush();
    expect(viewport.textContent).toContain('a8, Black rook');
    expect(board.moves).toEqual([]);
    viewport.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    flush();
    expect(viewport.dataset['chessInspection']).toBe('fit');
    board.down({ ...touch, square: 'e2' });
    board.move({ ...touch, square: 'e4' });
    board.up({ ...touch, square: 'e4' });
    expect(board.moves).toEqual(['e2e4']);
  } finally {
    board.unmount();
  }
});
