import { expect, test } from 'bun:test';
import { screen } from '@solidjs/testing-library';
import { mountBoard } from './board-fixture';

// regression: chess-promotion-below-short-landscape-fold
test('opening promotion reveals the whole choice stack at once', () => {
  const revealed: { element: Element; options: unknown }[] = [];
  const previous = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function (options) {
    revealed.push({ element: this, options });
  };
  const board = mountBoard({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 1' });
  try {
    board.down({ square: 'a7' });
    board.up({ square: 'a7' });
    board.down({ square: 'a8' });
    board.up({ square: 'a8' });
    const heading = screen.getByRole('heading', { name: 'Promote pawn' });
    const knight = screen.getByRole('button', { name: 'Knight' });
    const stack = revealed.find(
      ({ element }) => element.contains(heading) && element.contains(knight)
    );
    expect(stack?.options).toEqual({
      behavior: 'instant',
      block: 'nearest',
      inline: 'nearest',
    });
  } finally {
    board.unmount();
    HTMLElement.prototype.scrollIntoView = previous;
  }
});
