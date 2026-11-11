/** @jsxImportSource solid-js */
/**
 * A puzzle attempt as two small screens: the board with its own commands
 * and one control onward, then where the attempt stands.
 */

import { afterEach, expect, test } from 'bun:test';
import {
  type AttemptFigure,
  ContentAttemptScreenView,
  type ContentAttemptScreenViewProps,
} from '@libs/game-puzzle-client-ts/content-attempt-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

type Screen = ContentAttemptScreenViewProps['place']['screen'];

function mount(
  width: number,
  place: Screen,
  overrides: Partial<ContentAttemptScreenViewProps> = {}
): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 844 }}>
      <ContentAttemptScreenView
        status="ready"
        place={{ screen: place }}
        onOpen={() => undefined}
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
        wayOn={<span data-testid="way-on">Pack overview</span>}
        keptPositions={<span data-testid="kept">Saved positions</span>}
        onRetryChange={() => undefined}
        onReturnToLibrary={() => undefined}
        {...overrides}
      />
    </ThemeProvider>
  ));
}

const figures = (list: readonly AttemptFigure[]) => ({ figures: list });

function follows(a: Element, b: Element): boolean {
  return (
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}

// regression: puzzle-controls-below-info-card — Undo, Redo and Restart sat
// at the foot of the "This puzzle" card, so on a phone the pack's place,
// the description and the save status stood between the board (with
// Sokoban's movement buttons) and the commands that recover from a move.
// The commands sit with the board, and the panel is no longer on the
// board's screen at all: one control leads to it.
for (const width of [390, 1440]) {
  test(`at ${width}px the stage holds the board, its commands and one control onward`, () => {
    const opened: Screen[] = [];
    mount(width, 'attempt', { onOpen: (place) => opened.push(place.screen) });
    const controls = screen.getByTestId('controls');
    const onward = screen.getByTestId('content-open-progress');
    expect(follows(screen.getByTestId('player'), controls)).toBe(true);
    expect(follows(controls, onward)).toBe(true);
    const actions = controls.closest('[data-component="GameActions"]');
    expect(actions).not.toBe(null);
    expect(actions?.contains(onward)).toBe(true);
    // Nothing of where the attempt stands shares the board's screen.
    for (const elsewhere of [
      'puzzle-attempt-panel',
      'puzzle-attempt-pack-place',
      'puzzle-attempt-figures',
      'content-attempt-complete',
      'way-on',
      'kept',
    ])
      expect(screen.queryByTestId(elsewhere)).toBeNull();
    expect(onward.textContent).toBe('Progress');
    expect(onward.getAttribute('data-variant')).toBe('outline');
    fireEvent.click(onward);
    expect(opened).toEqual(['progress']);
    const root = screen.getByTestId('content-attempt');
    expect(root.getAttribute('data-place')).toBe('attempt');
    expect(root.getAttribute('data-screen')).toBe('puzzle-content-attempt');
  });
}

test('the stage has one status line: the save', () => {
  mount(390, 'attempt');
  const save = screen.getAllByTestId('content-position-save-status');
  expect(save).toHaveLength(1);
  expect(save[0]?.getAttribute('role')).toBe('status');
  expect(save[0]?.textContent).toBe('Progress saved on this device.');
  expect(follows(screen.getByTestId('player'), save[0] as Element)).toBe(true);
  cleanup();
  mount(390, 'attempt', { saving: true });
  expect(screen.getByTestId('content-position-save-status').textContent).toBe(
    'Saving your position…'
  );
});

test('once solved, the control onward is the one filled command', () => {
  mount(390, 'attempt', { complete: true });
  const onward = screen.getByTestId('content-open-progress');
  expect(onward.textContent).toBe('Solved: what next');
  expect(onward.getAttribute('data-variant')).toBe('solid');
  expect(onward.getAttribute('data-complete')).toBe('true');
  expect(
    document.querySelectorAll('[data-component="Button"][data-variant="solid"]')
  ).toHaveLength(1);
});

// regression: puzzle-attempt-rule-at-bottom — what the puzzle asks ("Join
// each pair of numbers and fill every square.") sat in the "This puzzle"
// card at the foot of a phone's screen. It now sits right above the board.
for (const width of [390, 1440]) {
  test(`at ${width}px the puzzle's rule is said right above the board`, () => {
    mount(width, 'attempt');
    const rule = screen.getByTestId('puzzle-attempt-rule');
    expect(rule.textContent).toBe(
      'Push each of the two crates onto its own goal.'
    );
    expect(follows(rule, screen.getByTestId('player'))).toBe(true);
  });
}

// regression: puzzle-attempt-title-hidden-on-phone — a phone hid the
// puzzle's own name ("Five pairs") as it hides a game's (the top bar names
// the game), but the bar names only the game, never the puzzle. The
// attempt keeps its title on a phone.
test("a phone keeps the puzzle's own title beside its difficulty", () => {
  mount(390, 'attempt');
  const heading = document.querySelector('[data-component="GameHeading"]');
  expect(heading?.getAttribute('data-keep-title')).toBe('true');
  expect(heading?.textContent).toContain('Two crates');
});

// regression: puzzle-panel-leads-with-sync — the puzzle panel was a card
// headed "This puzzle", then the pack's place, then a two-line note about
// saving and sharing, so beside a wide board it read as a large sync card
// and on a phone it added a heading's height under the commands. On the
// progress screen the pack's place is the panel's heading, and the save
// status one quiet caption after it.
for (const width of [390, 1440]) {
  test(`at ${width}px the progress panel is headed by the pack's place, the save status after`, () => {
    mount(width, 'progress');
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
    // The board and its commands stay on their own screen.
    expect(screen.queryByTestId('player')).toBeNull();
    expect(screen.queryByTestId('controls')).toBeNull();
    expect(screen.queryByTestId('content-open-progress')).toBeNull();
    const root = screen.getByTestId('content-attempt');
    expect(root.getAttribute('data-place')).toBe('progress');
    expect(root.getAttribute('data-attemptid')).toBe('attempt-1');
    expect(root.getAttribute('data-screen')).toBe(
      'puzzle-content-attempt-progress'
    );
  });
}

// regression: puzzle-panel-mostly-filler — beside a Sokoban or Numberlink
// board the "Puzzle 3 of 4" panel held only a two-line note, "Progress
// saved on this device. Changes share when connected.", so it was mostly
// filler and outweighed the puzzle's progress. Under its place the panel
// now shows how far through the pack the puzzle is, as a bar, then the
// pack's way on, and the save status is one short line.
for (const width of [390, 1440]) {
  test(`at ${width}px the panel shows the pack's progress and way on over one short save line`, () => {
    mount(width, 'progress');
    const panel = screen.getByTestId('puzzle-attempt-panel');
    const track = screen.getByTestId('puzzle-attempt-pack-track');
    expect(panel.contains(track)).toBe(true);
    const bar = track.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-label')).toBe('Puzzle 3 of 4');
    expect(bar?.getAttribute('aria-valuenow')).toBe('0.75');
    const wayOn = screen.getByTestId('way-on');
    expect(
      screen.getByTestId('puzzle-attempt-pack-actions').contains(wayOn)
    ).toBe(true);
    expect(follows(track, wayOn)).toBe(true);
    const save = screen.getByTestId('content-position-save-status');
    expect(follows(wayOn, save)).toBe(true);
    expect(save.textContent).toBe('Progress saved on this device.');
    // The kept positions come after the panel, on the same screen.
    expect(follows(panel, screen.getByTestId('kept'))).toBe(true);
    expect(
      screen
        .getByTestId('content-attempt-progress')
        .contains(screen.getByTestId('kept'))
    ).toBe(true);
  });
}

test('a puzzle on its own has no pack card: "This puzzle", and no way on', () => {
  mount(390, 'progress', { pack: null });
  const panel = screen.getByTestId('puzzle-attempt-panel');
  expect(panel.querySelector('h2')?.textContent).toBe('This puzzle');
  expect(screen.queryByTestId('puzzle-attempt-pack-track')).toBeNull();
  expect(screen.queryByTestId('puzzle-attempt-pack-actions')).toBeNull();
  cleanup();
  // A playtest's way on leads back to its builder.
  mount(390, 'progress', { pack: null, playtest: true });
  expect(
    screen
      .getByTestId('puzzle-attempt-pack-actions')
      .contains(screen.getByTestId('way-on'))
  ).toBe(true);
});

// regression: numberlink-progress-card-empty — beside a Numberlink board the
// puzzle panel held only its pack's place, a bar and "Progress saved on
// this device.", though the game counts its connected pairs and covered
// cells. The panel now shows the game's own figures for the attempt, under
// the pack's bar, and shows nothing more when the game gives none.
test("the progress panel shows the game's own figures for the attempt", () => {
  mount(
    1440,
    'progress',
    figures([
      { key: 'connectedPairs', label: 'Connected pairs', value: '2' },
      { key: 'coveredCells', label: 'Covered cells', value: '13' },
    ])
  );
  const panel = screen.getByTestId('puzzle-attempt-panel');
  const strip = screen.getByTestId('puzzle-attempt-figures');
  expect(panel.contains(strip)).toBe(true);
  expect(strip.getAttribute('data-component')).toBe('MetricStrip');
  expect(
    [...strip.querySelectorAll('dt')].map((term) => term.textContent)
  ).toEqual(['Connected pairs', 'Covered cells']);
  expect(strip.textContent).toContain('2');
  expect(strip.textContent).toContain('13');
  expect(follows(screen.getByTestId('puzzle-attempt-pack-track'), strip)).toBe(
    true
  );
  cleanup();
  mount(1440, 'progress');
  expect(screen.queryByTestId('puzzle-attempt-figures')).toBeNull();
});

// regression: puzzle-saved-completion-journey-copy
// regression: puzzle-saved-completion-confused-with-current-board
test('saved completion is a record on the progress screen, apart from the board being played', () => {
  mount(390, 'progress', { complete: true });
  const record = screen.getByTestId('content-attempt-complete');
  expect(record.textContent).toContain('Completion saved');
  expect(record.textContent).toContain('You can keep playing');
  expect(screen.getByTestId('puzzle-attempt-panel').contains(record)).toBe(
    true
  );
  cleanup();
  // The board's own screen keeps the board and its commands as they were.
  mount(390, 'attempt', { complete: true });
  expect(screen.queryByTestId('content-attempt-complete')).toBeNull();
  expect(screen.getByTestId('player').textContent).toBe('board');
  expect(screen.getByTestId('controls').textContent).toBe('Undo Redo Restart');
});

// regression: puzzle-solved-save-said-twice
test('a saved completion says it is saved once, in its own notice', () => {
  mount(390, 'progress', { complete: true });
  const record = screen.getByTestId('content-attempt-complete');
  const save = screen.getAllByTestId('content-position-save-status');
  expect(save.length).toBe(1);
  expect(record.contains(save[0] ?? null)).toBe(true);
  expect(record.textContent).toBe(
    'Completion savedProgress saved on this device. You can keep playing or choose another puzzle.'
  );
});

test('a change that was not saved and rules this app lacks are said on both screens', () => {
  for (const place of ['attempt', 'progress'] as const) {
    let retried = 0;
    mount(390, place, {
      changeError: 'The change was not saved.',
      rulesChanged: true,
      confirms: <span data-testid="confirms" />,
      onRetryChange: () => {
        retried += 1;
      },
    });
    expect(screen.getByText('Your change was not saved')).toBeDefined();
    expect(screen.getByText('The change was not saved.')).toBeDefined();
    expect(screen.getByTestId('content-attempt-rules-changed')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
    expect(retried).toBe(1);
    // The confirmation dialogs belong to the shell, outside either screen.
    expect(
      screen
        .getByTestId('content-attempt')
        .contains(screen.getByTestId('confirms'))
    ).toBe(false);
    cleanup();
  }
});

test('loading, gone and missing are states of their own, each with a way on', () => {
  mount(390, 'attempt', { status: 'loading' });
  expect(document.querySelector('[data-component="LoadingState"]')).not.toBe(
    null
  );
  expect(screen.queryByTestId('content-attempt')).toBeNull();
  cleanup();
  let returned = 0;
  for (const [status, title] of [
    ['gone', 'This attempt is no longer here'],
    ['missing', 'This puzzle has not reached this device'],
  ] as const) {
    mount(390, 'attempt', {
      status,
      onReturnToLibrary: () => {
        returned += 1;
      },
    });
    expect(screen.getByText(title)).toBeDefined();
    expect(screen.queryByTestId('content-attempt')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Return to puzzles' }));
    cleanup();
  }
  expect(returned).toBe(2);
});

test('a position that cannot be opened points at Progress for another one', () => {
  mount(390, 'attempt', { unopenable: true });
  expect(screen.queryByTestId('player')).toBeNull();
  expect(
    screen.getByText(/Choose another kept continuation under Progress/)
  ).toBeDefined();
  cleanup();
  mount(390, 'attempt', { unopenable: true, unreadable: true });
  expect(screen.getByText(/This puzzle cannot be opened\./)).toBeDefined();
});
