import { expect, test } from 'bun:test';
import { mountBoard } from './board-fixture';

// regression: chess-square-fit-contract-proof-missing
// regression: chess-puzzle-first-rank-selection
test('the puzzle king can move from e1 to f1 with guidance and square fitting enabled', () => {
  const board = mountBoard({
    fen: 'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
    showGuidance: true,
    showCoordinates: true,
    coordinatePlacement: 'outside-start',
    fitSquare: true,
  });
  try {
    board.down({ square: 'e1' });
    board.up({ square: 'e1' });
    expect(
      board.host
        .querySelector('[data-square="e1"]')
        ?.getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      board.host.querySelector('[data-square="f1"]')?.getAttribute('aria-label')
    ).toContain('Legal destination');
    board.down({ square: 'f1' });
    board.up({ square: 'f1' });
    expect(board.moves).toEqual(['e1f1']);
    expect(board.piece('f1')).toBeTruthy();
  } finally {
    board.unmount();
  }
});
