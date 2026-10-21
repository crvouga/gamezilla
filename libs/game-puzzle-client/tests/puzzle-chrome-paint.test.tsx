/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { HistoryPlyCluster } from '@libs/game-puzzle-client/puzzle-move-history-ply';
import { PuzzleRatingBadge } from '@libs/game-puzzle-client/puzzle-rating-badge';
import { PuzzleStatusHeader } from '@libs/game-puzzle-client/puzzle-status-header';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { cleanup, render, screen } from '@solidjs/testing-library';

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
  const fill = chip.querySelector('.bg-success-surface');
  expect(fill).not.toBeNull();
  expect(fill?.getAttribute('style') ?? '').not.toContain('success');
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
        <PuzzleStatusHeader kind="started" solverSide="White" />
      </ThemeProvider>
    </I18nProvider>
  ));
  // The row sizes to its content: no fixed height can clip a second line.
  const row = screen.getByTestId('chess-puzzle-status-row');
  expect(row.contains(screen.getByTestId('chess-puzzle-status-label'))).toBe(
    true
  );
  expect(row.getAttribute('style') ?? '').not.toMatch(/(^|;)\s*height:/);
  expect(row.className).not.toMatch(/(^|\s)h-/);
});
