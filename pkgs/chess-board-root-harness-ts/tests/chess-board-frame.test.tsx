/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ChessBoardFrame } from '@pkgs/chess-board-root-client-ts/chess-board-frame';

const SRC = join(import.meta.dirname, '../../chess-board-root-client-ts/src');
/** Every playing board (not a thumbnail) labels its edges outside. */
const PLAYING_QUERY = '@container chess-frame (min-width: 280px) {';

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

// regression: chess-coordinates-inconsistent — a desktop board wrote its
// coordinates in the squares' corners while a phone's wrote them outside,
// and a puzzle's phone board inside again: every playing board now labels
// its edges outside, and only a thumbnail keeps corner labels.
test('every playing board shows the outside labels, and its corner labels step aside', () => {
  const frame = readFileSync(
    join(SRC, 'chess-board-frame/chess-board-frame.module.css'),
    'utf8'
  );
  const board = readFileSync(
    join(SRC, 'chess-board/chess-board.module.css'),
    'utf8'
  );
  expect(frame).toContain(PLAYING_QUERY);
  expect(frame).not.toContain('max-width: 479px');
  expect(frame).toMatch(/font-size:\s*12px;/);
  const corner = board.slice(board.indexOf(PLAYING_QUERY));
  expect(board.indexOf(PLAYING_QUERY)).toBeGreaterThan(-1);
  expect(corner).toMatch(/\.coords\s*\{\s*display:\s*none;/);
});

// regression: chess-board-inset-from-seats — the rank labels stood in a
// 20px gutter inside the board's column, so the squares started 20px in
// from the player bars above and below them. The frame marks that gutter,
// and a game's board stage starts its seats past it: the bars and the
// squares share both edges, and the labels stand out in the margin.
test('the frame marks its labels gutter, and the stage starts its seats past it', () => {
  const view = render(() => (
    <ChessBoardFrame orientation="white">
      <div />
    </ChessBoardFrame>
  ));
  const host = view.container.querySelector('[data-board-gutter]');
  expect(host?.getAttribute('data-board-gutter')).toBe('start');
  view.unmount();
  const frame = readFileSync(
    join(SRC, 'chess-board-frame/chess-board-frame.module.css'),
    'utf8'
  );
  const playing = frame.slice(frame.indexOf(PLAYING_QUERY));
  // 16px of ranks and a 4px gap: a 20px gutter.
  expect(playing).toMatch(/grid-template-columns: 16px minmax\(0, 1fr\);/);
  expect(playing).toMatch(/column-gap: 4px;/);
  const stage = readFileSync(
    join(import.meta.dirname, '../../ui-root-client-ts/src/game-ui.module.css'),
    'utf8'
  );
  const rule = stage.slice(
    stage.indexOf(
      '.boardStage:not([data-preview="true"]):has([data-board-gutter="start"])'
    )
  );
  expect(rule.slice(0, rule.indexOf('}'))).toMatch(
    />\s*:not\(\.board\)\s*\{\s*margin-inline-start: 20px;/
  );
});

// regression: chess-board-inset-from-title — wide, the squares still began
// 20px in from the screen's title, the rank labels' gutter standing inside
// the board's column at its start. Wide, the ranks now stand at the
// board's end edge: the squares start at the column's edge, under the
// title, and the seats end short of the gutter instead. A phone keeps the
// ranks at the start.
test('wide, the ranks stand at the end, the squares under the title', () => {
  const view = render(() => (
    <ChessBoardFrame orientation="white" ranks="end">
      <div />
    </ChessBoardFrame>
  ));
  const host = view.container.querySelector('[data-board-gutter]');
  expect(host?.getAttribute('data-board-gutter')).toBe('end');
  expect(host?.querySelector('[data-ranks]')?.getAttribute('data-ranks')).toBe(
    'end'
  );
  view.unmount();
  const frame = readFileSync(
    join(SRC, 'chess-board-frame/chess-board-frame.module.css'),
    'utf8'
  );
  const playing = frame.slice(frame.indexOf(PLAYING_QUERY));
  expect(playing).toMatch(
    /\.frame\[data-ranks="end"\] \{\s*grid-template-columns: minmax\(0, 1fr\) 16px;/
  );
  expect(playing).toMatch(
    /\.frame\[data-ranks="end"\] \.ranks \{\s*grid-column: 2;/
  );
  const stage = readFileSync(
    join(import.meta.dirname, '../../ui-root-client-ts/src/game-ui.module.css'),
    'utf8'
  );
  const rule = stage.slice(
    stage.indexOf(
      '.boardStage:not([data-preview="true"]):has([data-board-gutter="end"])'
    )
  );
  expect(rule.slice(0, rule.indexOf('}'))).toMatch(
    />\s*:not\(\.board\)\s*\{\s*margin-inline-end: 20px;/
  );
});
