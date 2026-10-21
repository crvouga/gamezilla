/**
 * The board's stylesheet paints app chrome (the keyboard focus ring) only
 * with design-system color tokens that exist, so the ring follows the app's
 * light and dark schemes instead of a hard-coded fallback.
 */

import { expect, test } from 'bun:test';
import { renderTokensCss } from '@pkgs/ui-root-shared/css-vars';

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
