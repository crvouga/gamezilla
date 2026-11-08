/**
 * The board's stylesheet paints app chrome (the keyboard focus ring) only
 * with design-system color tokens that exist, so the ring follows the app's
 * light and dark schemes instead of a hard-coded fallback.
 */

import { expect, test } from 'bun:test';
import { renderTokensCss } from '@pkgs/ui-root-shared-ts/css-vars';

function referencedColorTokens(css: string): readonly string[] {
  return [...css.matchAll(/var\((--ui-color-[\w-]+)/g)].map(
    (match) => match[1] ?? ''
  );
}

// regression: chess-board-focus-ring-missing-token
test('every design-system color the board stylesheet reads is a declared token', () => {
  const board = [...document.head.querySelectorAll('style')]
    .map((style) => style.textContent)
    .join('\n');
  const referenced = referencedColorTokens(board);
  expect(referenced).toContain('--ui-color-focus-ring');
  const declared = renderTokensCss();
  const missing = referenced.filter((token) => !declared.includes(`${token}:`));
  expect(missing).toEqual([]);
});

// regression: chess-last-move-tan-wash
test('last-move wash has a board-ink perimeter in addition to its yellow fill', () => {
  const board = [...document.head.querySelectorAll('style')]
    .map((style) => style.textContent)
    .join('\n');
  const rule = /[^{}]*\[data-kind=["']?last-move["']?\][^{]*\{([^}]+)\}/.exec(
    board
  )?.[1];
  expect(rule).toContain('var(--chess-last-move)');
  expect(rule).toContain('var(--chess-border)');
  expect(rule).toContain('inset');
});

// regression: chess-focus-ring-low-contrast-on-walnut
test('the focus ring pairs the app ring with the board-derived contrast band', () => {
  const board = [...document.head.querySelectorAll('style')]
    .map((style) => style.textContent)
    .join('\n');
  const rule = /square:focus-visible[^{]*\{([^}]+)\}/.exec(board)?.[1];
  expect(rule).toContain('var(--ui-color-focus-ring)');
  expect(rule).toContain('var(--chess-focus-band)');
  expect(rule).toContain('inset');
});

// regression: chess-puzzle-guidance-below-short-landscape-fold
test('open keyboard help floats over the board in a short landscape window', () => {
  const board = [...document.head.querySelectorAll('style')]
    .map((style) => style.textContent)
    .join('\n');
  const query = /@media \(orientation: landscape\) and \([^)]*560px\)/.exec(
    board
  );
  const landscape = board.slice(query?.index ?? board.length);
  const rule = /keyboardHelp\[open\] > :last-child\s*\{([^}]*)\}/.exec(
    landscape
  )?.[1];
  expect(rule).toContain('position: absolute');
  expect(rule).toContain('var(--ui-color-surface)');
});
