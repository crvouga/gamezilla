/** @jsxImportSource solid-js */
/** A puzzle attempt: the board and its commands first, the puzzle panel after. */

import { afterEach, expect, test } from 'bun:test';
import {
  type AttemptFigure,
  ContentAttemptScreenView,
} from '@libs/game-puzzle-client-ts/content-attempt-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(
  width: number,
  figures: readonly AttemptFigure[] = [],
  complete = false
): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 844 }}>
      <ContentAttemptScreenView
        status="ready"
        figures={figures}
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
        complete={complete}
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

// regression: puzzle-panel-leads-with-sync — the puzzle panel was a card
// headed "This puzzle", then the pack's place, then a two-line note about
// saving and sharing, so beside a wide board it read as a large sync card
// and on a phone it added a heading's height under the commands. The
// pack's place is now the panel's heading, and the save status one quiet
// caption after it.
for (const width of [390, 1440]) {
  test(`at ${width}px the puzzle panel is headed by the pack's place, the save status after`, () => {
    mount(width);
    const panel = screen.getByTestId('puzzle-attempt-panel');
    const heading = panel.querySelector('h2');
    expect(heading?.textContent).toBe('Puzzle 3 of 4 in Warehouse basics');
    expect(
      heading?.contains(screen.getByTestId('puzzle-attempt-pack-place'))
    ).toBe(true);
    expect(panel.textContent).not.toContain('This puzzle');
    const save = screen.getByTestId('content-position-save-status');
    expect(follows(heading as Element, save)).toBe(true);
    expect(save.className).toContain('textCaption');
  });
}

// regression: puzzle-panel-mostly-filler — beside a Sokoban or Numberlink
// board the "Puzzle 3 of 4" panel held only a two-line note, "Progress
// saved on this device. Changes share when connected.", so it was mostly
// filler and outweighed the puzzle's progress. Under its place the panel
// now shows how far through the pack the puzzle is, as a bar, and the
// save status is one short line.
for (const width of [390, 1440]) {
  test(`at ${width}px the panel shows the pack's progress over one short save line`, () => {
    mount(width);
    const panel = screen.getByTestId('puzzle-attempt-panel');
    const track = screen.getByTestId('puzzle-attempt-pack-track');
    expect(panel.contains(track)).toBe(true);
    const bar = track.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-label')).toBe('Puzzle 3 of 4');
    expect(bar?.getAttribute('aria-valuenow')).toBe('0.75');
    const save = screen.getByTestId('content-position-save-status');
    expect(follows(track, save)).toBe(true);
    expect(save.textContent).toBe('Progress saved on this device.');
  });
}

// regression: numberlink-progress-card-empty — beside a Numberlink board the
// puzzle panel held only its pack's place, a bar and "Progress saved on
// this device.", though the game counts its connected pairs and covered
// cells. The panel now shows the game's own figures for the attempt, under
// the pack's bar, and shows nothing more when the game gives none.
test("the puzzle panel shows the game's own figures for the attempt", () => {
  mount(1440, [
    { key: 'connectedPairs', label: 'Connected pairs', value: '2' },
    { key: 'coveredCells', label: 'Covered cells', value: '13' },
  ]);
  const panel = screen.getByTestId('puzzle-attempt-panel');
  const figures = screen.getByTestId('puzzle-attempt-figures');
  expect(panel.contains(figures)).toBe(true);
  expect(figures.getAttribute('data-component')).toBe('MetricStrip');
  expect(
    [...figures.querySelectorAll('dt')].map((term) => term.textContent)
  ).toEqual(['Connected pairs', 'Covered cells']);
  expect(figures.textContent).toContain('2');
  expect(figures.textContent).toContain('13');
  expect(
    follows(screen.getByTestId('puzzle-attempt-pack-track'), figures)
  ).toBe(true);
  cleanup();
  mount(1440);
  expect(screen.queryByTestId('puzzle-attempt-figures')).toBeNull();
});

// regression: puzzle-saved-completion-journey-copy
// regression: puzzle-saved-completion-confused-with-current-board
test('saved completion remains distinct when the player has moved beyond the solved position', () => {
  mount(390, [], true);
  const record = screen.getByTestId('content-attempt-complete');
  expect(record.textContent).toContain('Completion saved');
  expect(record.textContent).toContain('You can keep playing');
  expect(screen.getByTestId('puzzle-attempt-panel').contains(record)).toBe(
    true
  );
  expect(screen.getByTestId('player').textContent).toBe('board');
  expect(screen.getByTestId('controls').textContent).toBe('Undo Redo Restart');
});
