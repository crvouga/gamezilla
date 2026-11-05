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

// regression: puzzle-attempt-rule-at-bottom — what the puzzle asks ("Join
// each pair of numbers and fill every square.") sat in the "This puzzle"
// card at the foot of a phone's screen. It now sits right above the board.
for (const width of [390, 1440]) {
  test(`at ${width}px the puzzle's rule is said right above the board`, () => {
    mount(width);
    const rule = screen.getByTestId('puzzle-attempt-rule');
    expect(rule.textContent).toBe(
      'Push each of the two crates onto its own goal.'
    );
    expect(follows(rule, screen.getByTestId('player'))).toBe(true);
    expect(screen.getByTestId('puzzle-attempt-panel').contains(rule)).toBe(
      false
    );
  });
}

// regression: puzzle-attempt-title-hidden-on-phone — a phone hid the
// puzzle's own name ("Five pairs") as it hides a game's (the top bar names
// the game), but the bar names only the game, never the puzzle. The
// attempt keeps its title on a phone.
test("a phone keeps the puzzle's own title beside its difficulty", () => {
  mount(390);
  const heading = document.querySelector('[data-component="GameHeading"]');
  expect(heading?.getAttribute('data-keep-title')).toBe('true');
  expect(heading?.textContent).toContain('Two crates');
});
