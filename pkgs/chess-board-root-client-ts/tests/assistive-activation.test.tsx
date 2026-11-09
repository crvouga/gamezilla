import { afterEach, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { fireEvent, screen } from '@solidjs/testing-library';
import fc from 'fast-check';
import { type MountedBoard, mountBoard } from './board-fixture';

let board: MountedBoard | undefined;
afterEach(() => board?.unmount());

function activate(square: string, detail = 0) {
  const button = board?.host.querySelector<HTMLButtonElement>(
    `[data-square="${square}"]`
  );
  if (!button) throw new Error(`Missing ${square}`);
  fireEvent.click(button, { detail });
}

// regression: chess-assistive-click-activation
test('click-only activation of e2 then e4 offers the same move as keyboard input', () => {
  board = mountBoard();
  activate('e2');
  expect(
    screen
      .getByRole('button', { name: 'e2, White pawn' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  activate('e4');
  expect(board.moves).toEqual(['e2e4']);
  expect(screen.getByRole('button', { name: 'e4, White pawn' })).toBeTruthy();
});

test('all opening pawn activations retain their square identity in either orientation', () => {
  assertProperty(
    'chess-assistive-opening-pawns',
    fc.property(
      fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'),
      fc.constantFrom('white' as const, 'black' as const),
      (file, orientation) => {
        board = mountBoard({ orientation });
        activate(`${file}2`);
        activate(`${file}4`);
        expect(board.moves).toEqual([`${file}2${file}4`]);
        board.unmount();
      }
    )
  );
});

test('a pointer click following pointerdown and pointerup does not toggle selection twice', () => {
  board = mountBoard();
  board.down({ square: 'e2' });
  board.up({ square: 'e2' });
  activate('e2', 1);
  expect(
    screen
      .getByRole('button', { name: 'e2, White pawn' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  activate('e4');
  expect(board.moves).toEqual(['e2e4']);
});

// regression: chess-disabled-square-semantics
test('a read-only board names its unavailable squares while preserving exploration', () => {
  board = mountBoard({ interactive: false });
  const square = screen.getByRole('button', { name: 'e2, White pawn' });
  expect(square.getAttribute('aria-disabled')).toBe('true');
  square.focus();
  expect(document.activeElement).toBe(square);
  activate('e2');
  activate('e4');
  expect(board.moves).toEqual([]);
});

// regression: chess-promotion-focus-boundary
test('a7 promotion is a named dialog with a closed Tab boundary and returns focus on cancellation', () => {
  board = mountBoard({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 1' });
  board.down({ square: 'a7' });
  board.up({ square: 'a7' });
  board.down({ square: 'a8' });
  board.up({ square: 'a8' });
  const dialog = screen.getByRole('dialog', { name: 'Promote pawn' });
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  const queen = screen.getByRole('button', { name: 'Queen' });
  const cancel = screen.getByRole('button', { name: 'Cancel promotion' });
  expect(document.activeElement).toBe(queen);
  fireEvent.keyDown(queen, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(cancel, { key: 'Tab' });
  expect(document.activeElement).toBe(queen);
  fireEvent.keyDown(queen, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement?.getAttribute('data-square')).toBe('a7');
  expect(board.moves).toEqual([]);
});
