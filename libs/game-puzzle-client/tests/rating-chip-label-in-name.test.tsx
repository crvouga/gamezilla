/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { PuzzleRatingChip } from '@libs/game-puzzle-client/puzzle-rating-chip';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { cleanup, render } from '@solidjs/testing-library';

afterEach(cleanup);

test("a hidden puzzle rating inside a button says nothing the button's name leaves out", () => {
  // regression: puzzle-feed-label-not-in-name
  const { container } = render(() => (
    <button type="button">
      <span class="sr-only">Puzzle feed. Automatic target 1500.</span>
      <span>pool01</span>
      <PuzzleRatingChip rating={0} variant="muted" invisible />
      <span>Auto · 1500</span>
    </button>
  ));
  expect(container.textContent ?? '').not.toMatch(/\b0\b/);
  expect(auditTree(container).map(formatFailure)).toEqual([]);
});
