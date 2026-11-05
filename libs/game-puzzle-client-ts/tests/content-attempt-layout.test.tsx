/** @jsxImportSource solid-js */
/** A puzzle attempt: the board and its commands first, the puzzle panel after. */

import { afterEach, expect, test } from 'bun:test';
import { ContentAttemptScreenView } from '@libs/game-puzzle-client-ts/content-attempt-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(width: number): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 844 }}>
      <ContentAttemptScreenView
        status="ready"
        attempt={{
          id: 'attempt-1',
          sourceId: 'revision-1',
          packRevisionId: 'pack-1',
          title: 'Two crates',
          difficulty: 'Easy',
          description: 'Push each of the two crates onto its own goal.',
        }}
        pack={{ title: 'Warehouse basics', position: 3, total: 4 }}
        playtest={false}
        saving={false}
        changeError={null}
        complete={false}
        rulesChanged={false}
        unopenable={false}
        player={<span data-testid="player">board</span>}
        controls={<span data-testid="controls">Undo Redo Restart</span>}
        onRetryChange={() => undefined}
        onReturnToLibrary={() => undefined}
      />
    </ThemeProvider>
  ));
}

function follows(a: Element, b: Element): boolean {
  return (
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}

// regression: puzzle-controls-below-info-card — Undo, Redo and Restart sat
// at the foot of the "This puzzle" card, so on a phone the pack's place,
// the description and the save status stood between the board (with
// Sokoban's movement buttons) and the commands that recover from a move.
// The commands now sit with the board; the card is secondary, after them.
for (const width of [390, 1440]) {
  test(`at ${width}px the attempt's commands come before the puzzle panel`, () => {
    mount(width);
    const panel = screen.getByTestId('puzzle-attempt-panel');
    const controls = screen.getByTestId('controls');
    expect(panel.contains(controls)).toBe(false);
    expect(follows(controls, panel)).toBe(true);
    expect(follows(screen.getByTestId('player'), controls)).toBe(true);
    expect(controls.closest('[data-component="GameActions"]')).not.toBe(null);
  });
}
