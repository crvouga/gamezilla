/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ChessBoardFrame } from '@pkgs/chess-board-root-client-ts/chess-board-frame';

const SRC = join(import.meta.dirname, '../../chess-board-root-client-ts/src');
/** The phone-sized boards the outside labels are for. */
const PHONE_QUERY =
  '@container chess-frame (min-width: 280px) and (max-width: 479px)';

function labels(container: HTMLElement): readonly string[][] {
  return [...container.querySelectorAll('[aria-hidden="true"]')].map((edge) =>
    [...edge.children].map((label) => label.textContent)
  );
}

// regression: chessboard-phone-coordinates-minute — on a 358px phone board
// the corner labels were capped at what a square's corner holds (~9px),
// still minute: a phone-sized board labels its edges outside the squares.
test('the frame labels ranks down its edge and files along its foot, from the viewer side', () => {
  const white = render(() => (
    <ChessBoardFrame orientation="white">
      <div data-testid="board" />
    </ChessBoardFrame>
  ));
  expect(labels(white.container)).toEqual([
    ['8', '7', '6', '5', '4', '3', '2', '1'],
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
  ]);
  expect(white.getByTestId('board')).toBeTruthy();
  white.unmount();
  const black = render(() => (
    <ChessBoardFrame orientation="black">
      <div />
    </ChessBoardFrame>
  ));
  expect(labels(black.container)).toEqual([
    ['1', '2', '3', '4', '5', '6', '7', '8'],
    ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'],
  ]);
  black.unmount();
});

test('only a phone-sized board shows the outside labels, and its corner labels step aside', () => {
  const frame = readFileSync(
    join(SRC, 'chess-board-frame/chess-board-frame.module.css'),
    'utf8'
  );
  const board = readFileSync(
    join(SRC, 'chess-board/chess-board.module.css'),
    'utf8'
  );
  expect(frame).toContain(PHONE_QUERY);
  expect(frame).toMatch(/font-size:\s*12px;/);
  const corner = board.slice(board.indexOf(PHONE_QUERY));
  expect(corner).toMatch(/\.coords\s*\{\s*display:\s*none;/);
});
