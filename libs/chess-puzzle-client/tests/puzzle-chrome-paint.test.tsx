/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { HistoryPlyCluster } from '@libs/chess-puzzle-client/chess-puzzle-move-history-ply';
import { ChessPuzzleRatingChip } from '@libs/chess-puzzle-client/chess-puzzle-rating-chip';
import { ChessPuzzleStatusHeader } from '@libs/chess-puzzle-client/chess-puzzle-status-header';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { cleanup, render, screen } from '@solidjs/testing-library';

afterEach(cleanup);

test('the rating chip paints its fill and color from classes, not token names', () => {
  // regression: puzzle-rating-chip-token-as-css
  const { container } = render(() => (
    <ChessPuzzleRatingChip rating={1500} testID="chip" />
  ));
  const chip = screen.getByTestId('chip');
  expect(chip.className).toContain('bg-tint-subtle');
  expect(chip.getAttribute('style') ?? '').not.toContain('tint');
  const label = container.querySelector('p');
  expect(label?.className).toContain('text-tint');
  expect(label?.getAttribute('style') ?? '').not.toContain('tint');
});

test('the current move is highlighted by classes, not token names', () => {
  // regression: puzzle-move-highlight-token-as-css
  render(() => (
    <HistoryPlyCluster
      ply={{
        plyIndex: 0,
        solveIdxAfter: 1,
        san: 'Qxf3',
        color: 'w',
        moveNumber: 52,
      }}
      selectedSolveIdx={1}
      interactive
      notation="san"
      onSeek={() => undefined}
    />
  ));
  const chip = screen.getByTestId('chess-puzzle-move-ply-0');
  expect(chip.className).toContain('bg-success-surface');
  expect(chip.getAttribute('style') ?? '').not.toContain('success');
  const san = chip.querySelector('code');
  expect(san?.className).toContain('text-success');
  expect(san?.getAttribute('style') ?? '').not.toContain('success');
});

test('a two-line status prompt grows its row instead of overlapping the coach', () => {
  // regression: puzzle-status-overlaps-coach
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  render(() => (
    <I18nProvider i18n={i18n}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 640 }}
      >
        <ChessPuzzleStatusHeader kind="started" sideToMove="white" />
      </ThemeProvider>
    </I18nProvider>
  ));
  const row = screen.getByTestId('chess-puzzle-status-label').parentElement;
  const style = row?.getAttribute('style') ?? '';
  expect(style).toContain('min-height');
  expect(style).not.toMatch(/(^|;)\s*height:/);
});
