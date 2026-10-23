/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { PuzzleRatingBadge } from '@libs/game-puzzle-client-ts/puzzle-rating-badge';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { P } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { cleanup, render } from '@solidjs/testing-library';

afterEach(cleanup);

test("a hidden puzzle rating inside a button says nothing the button's name leaves out", () => {
  // regression: puzzle-feed-label-not-in-name
  const { container } = render(() => (
    <Pressable>
      <VisuallyHidden>Puzzle feed. Automatic target 1500.</VisuallyHidden>
      <P variant="mono">pool01</P>
      <PuzzleRatingBadge rating={0} invisible />
      <Badge intent="neutral" label="Auto · 1500" />
    </Pressable>
  ));
  expect(container.textContent ?? '').not.toMatch(/\b0\b/);
  expect(auditTree(container).map(formatFailure)).toEqual([]);
});
