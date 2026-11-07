import { expect, test } from 'bun:test';
import { fireEvent, screen } from '@solidjs/testing-library';
import { mountBoard } from './board-fixture';

// regression: chess-promotion-silhouette-only
test('a7 to a8 offers visible named promotions and cancellation before committing', () => {
  const board = mountBoard({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 1' });
  const promote = () => {
    board.down({ square: 'a7' });
    board.up({ square: 'a7' });
    board.down({ square: 'a8' });
    board.up({ square: 'a8' });
  };
  promote();
  expect(screen.getByRole('heading', { name: 'Promote pawn' })).toBeTruthy();
  for (const name of ['Queen', 'Rook', 'Bishop', 'Knight']) {
    expect(screen.getByRole('button', { name }).textContent).toContain(name);
  }
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Queen' })
  );
  fireEvent.keyDown(screen.getByRole('button', { name: 'Queen' }), {
    key: 'Escape',
  });
  expect(board.moves).toEqual([]);
  promote();
  fireEvent.click(screen.getByRole('button', { name: 'Knight' }));
  expect(screen.getByRole('button', { name: 'a8, White knight' })).toBeTruthy();
  expect(board.moves).toEqual(['a7a8']);
  board.unmount();
});
