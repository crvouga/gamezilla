import { expect, test } from 'bun:test';
import { screen } from '@solidjs/testing-library';
import { mountBoard } from './board-fixture';

// regression: chess-check-and-side-guidance
test('a checked black king has visible check, orientation and keyboard guidance', () => {
  const board = mountBoard({
    fen: 'rnbqkbnr/ppp2ppp/8/1B1pp3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3',
    orientation: 'black',
    showGuidance: true,
    interactive: true,
  });
  expect(screen.getByText(/Black pieces nearest you/).textContent).toContain(
    'Black is in check.'
  );
  expect(screen.getByText(/Escape to cancel/)).toBeTruthy();
  board.setOrientation('white');
  expect(screen.getByText(/White pieces nearest you/).textContent).toContain(
    'Black is in check.'
  );
});
