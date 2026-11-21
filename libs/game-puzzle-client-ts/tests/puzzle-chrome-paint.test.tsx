/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { HistoryPlyCluster } from '@libs/game-puzzle-client-ts/puzzle-move-history-ply';
import { PuzzleRatingBadge } from '@libs/game-puzzle-client-ts/puzzle-rating-badge';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { mountPlay } from './puzzle-play-view-fixture';

afterEach(cleanup);

test('the rating badge paints from its intent, not token names', () => {
  // regression: puzzle-rating-chip-token-as-css
  render(() => (
    <PuzzleRatingBadge rating={1500} intent="brand" testId="chip" />
  ));
  const chip = screen.getByTestId('chip');
  expect(chip.getAttribute('data-component')).toBe('Badge');
  expect(chip.getAttribute('data-intent')).toBe('brand');
  expect(chip.getAttribute('style') ?? '').not.toContain('tint');
  expect(chip.textContent).toBe('1500');
});

test('the current move is highlighted by classes, not token names', () => {
  // regression: puzzle-move-highlight-token-as-css
  render(() => (
    <HistoryPlyCluster
      ply={{
        plyIndex: 0,
        solveIdxAfter: 1,
        label: 'Qxf3',
        before: 'a position',
      }}
      selectedSolveIdx={1}
      interactive
      writing={{
        notation: () => '',
        format: (label) => label,
        moveNumber: () => '52.',
      }}
      onSeek={() => undefined}
    />
  ));
  const chip = screen.getByTestId('chess-puzzle-move-ply-0');
  expect(chip.getAttribute('aria-pressed')).toBe('true');
  // regression: puzzle-move-highlight-reads-as-correct — the current move
  // was the success green, the same paint as the "Correct" pill over it,
  // so the two read as one signal. The move on the board is what is
  // chosen: the selection's blue, never the green of a correct answer.
  expect(chip.querySelector('.bg-success-surface')).toBeNull();
  const fill = chip.querySelector('.bg-tint-subtle');
  expect(fill).not.toBeNull();
  expect(fill?.getAttribute('style') ?? '').not.toContain('tint');
  const san = chip.querySelector('code');
  expect(san?.className).toContain('text-tint');
  expect(san?.className).not.toContain('text-success');
  expect(san?.getAttribute('style') ?? '').not.toContain('tint');
});

test('the status line stands apart from the coach, so neither overlaps the other', () => {
  // regression: puzzle-status-overlaps-coach
  mountPlay('play');
  const label = screen.getByTestId('chess-puzzle-status-label');
  const coach = screen.getByText('Something on the board is undefended.');
  // The status is the space's one status line; the coach speaks in the
  // stage under it, never inside a row the status sizes.
  expect(label.parentElement?.contains(coach)).toBe(false);
  expect(label.getAttribute('style') ?? '').not.toMatch(/(^|;)\s*height:/);
});
