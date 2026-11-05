/** @jsxImportSource solid-js */
/** Before a search: one card holds the choice, its conditions and what the person brings. */

import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MultiplayerScreenView } from '@libs/game-matchmaking-client-ts/multiplayer-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(width: number): HTMLElement {
  const time = createHarnessClock();
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
        <MultiplayerScreenView
          title="Connect Four"
          stage="search"
          next={{ kind: 'find', players: 2, timed: false }}
          error={null}
          online
          ratings={[{ pool: 'game', rating: 1512, games: 7 }]}
          confirming={null}
          manyPlayers={false}
          onFind={() => Promise.resolve()}
          onStop={() => Promise.resolve()}
          onConfirm={() => Promise.resolve()}
          onCloseConfirm={() => undefined}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

// regression: matchmaking-columns-lopsided — wide, a 210px search card sat
// beside a 500px rail of ratings and three paragraphs on how matchmaking
// works, so the explanation outweighed the decision.
test('wide: the search, the ratings and a short guide are one card, with no rail beside it', () => {
  const container = mount(1440);
  const card = container.querySelector('[data-component="GameSetupPanel"]');
  if (card === null) throw new Error('No search card');
  expect(card.contains(screen.getByTestId('multiplayer-rating-game'))).toBe(
    true
  );
  expect(card.contains(screen.getByTestId('multiplayer-guide'))).toBe(true);
  expect(
    container
      .querySelector('[data-component="GameLayout"]')
      ?.getAttribute('data-has-aside')
  ).toBe('false');
});

// regression: matchmaking-intro-wordy — the card said "Find someone to
// play with." and "This search finds / A rated game with no clock" before
// its one command.
// regression: match-conditions-unlike-game-chips — the conditions were
// plain "Rated · No clock" text while a game's title showed "Unrated"
// "Untimed" as chips, and wide they floated about 60px above the command.
// regression: match-chips-look-pressable — the conditions were then pills
// that looked pressable and said "No clock" where a game says "Untimed".
// They are the game's own quiet settings line, in the game's words.
test("the conditions are the game's settings line, right above the command", () => {
  for (const width of [390, 1440]) {
    mount(width);
    const conditions = screen.getByTestId('multiplayer-find-conditions');
    expect(conditions.getAttribute('data-component')).toBe('GameFacts');
    expect(conditions.querySelector('[data-component="Badge"]')).toBeNull();
    const facts = [
      ...conditions.querySelectorAll('[data-component="GameFact"]'),
    ].map((fact) => fact.textContent);
    expect(facts).toEqual(['Rated', 'Untimed']);
    // The chips and the command are one group: the command comes next.
    const actions = conditions.nextElementSibling;
    expect(
      actions?.contains(screen.getByTestId('multiplayer-find')) === true
    ).toBe(true);
    expect(screen.queryByText('Find someone to play with.')).toBeNull();
    expect(screen.queryByText('This search finds')).toBeNull();
    cleanup();
  }
});

// regression: matchmaking-phone-drops-guide — a phone left out "How
// matchmaking works", which the wide card explains.
// regression: matchmaking-guide-dominates — wide, the three points of the
// guide sat open under the search and outweighed its one command. A phone
// keeps them behind one closed disclosure.
test('phone: the ratings are in the card and the guide behind one closed disclosure', () => {
  const container = mount(390);
  const card = container.querySelector('[data-component="GameSetupPanel"]');
  expect(card?.contains(screen.getByTestId('multiplayer-rating-game'))).toBe(
    true
  );
  const guide = screen.getByTestId('multiplayer-guide');
  expect(card?.contains(guide)).toBe(true);
  const toggle = screen.getByTestId('multiplayer-guide-toggle');
  expect(toggle.textContent).toContain('How matchmaking works');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText('Every match is rated')).toBeNull();
  toggle.click();
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText('Every match is rated')).toBeTruthy();
});

// regression: matchmaking-card-lonely — wide, a 720px card sat at the
// game column's start with about 70% of the canvas empty beside and under
// it. The card fills the game column: the search and the ratings side by
// side, the guide's three short points across the card's foot.
// regression: matchmaking-columns-equal-weight — the columns were then
// equal, so the search and its command carried no more weight than
// reference text. The search leads, the wider column, and the guide is
// quiet caption text.
// regression: matchmaking-guide-nested-card — the guide then stood as a
// sunken grey card inside the card, a third column as tall as the row, so
// the search's column stood mostly empty under its command. The guide is
// plain quiet text across the card's foot, past its hairline, never a box.
test("wide: the search leads the card's two columns and the guide is quiet text across its foot", () => {
  const container = mount(1440);
  const card = container.querySelector('[data-component="GameSetupPanel"]');
  const split = card?.querySelector('[data-setup-split="true"]');
  expect(split?.getAttribute('data-details-across')).toBe('true');
  const guide = screen.getByTestId('multiplayer-guide');
  expect(card?.contains(guide)).toBe(true);
  // The guide follows the search and the ratings, at the card's foot.
  expect(
    screen
      .getByTestId('multiplayer-rating-game')
      .compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  // Open, headed like the ratings, with no disclosure to press.
  expect(screen.queryByTestId('multiplayer-guide-toggle')).toBeNull();
  expect(guide.textContent).toContain('How matchmaking works');
  expect(screen.getByText('Every match is rated')).toBeTruthy();
  // Its three points side by side.
  expect(guide.querySelector('[role="list"]')?.className).toContain(
    'grid-cols-3'
  );
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../../pkgs/ui-root-client-ts/src/game-setup-panel/game-setup-panel.module.css'
    ),
    'utf8'
  );
  expect(css).toMatch(
    /section:has\(> \.setupSplit\[data-details-across="true"\]\) \{\s*grid-template-columns: minmax\(0, 3fr\) minmax\(0, 2fr\);\s*\}/
  );
  // No rule gives the guide a box of its own: it spans the card's foot.
  expect(css).not.toMatch(/data-details-across="true"\] ~ \*/);
  expect(css).not.toContain('surface-muted');
  expect(css).toMatch(
    /section > \.setupSplit ~ \* \{\s*grid-column: 1 \/ -1;\s*grid-row: 3;/
  );
  // The guide's heading and points are quieter than the search's title.
  const heading = [...guide.querySelectorAll('h3')].find((h) =>
    h.textContent?.includes('How matchmaking works')
  );
  expect(heading?.className).toContain('text-text-secondary');
});

// regression: provisional-rating-reads-as-error — "1512?" read like an
// error: the "?" the spec keeps is a quiet glyph beside the number.
// regression: provisional-rating-said-three-ways — the "?", a
// "Provisional" tag and a footnote all said the rating was provisional.
// The "?" stays, and the footnote alone says what it means.
test('a provisional rating keeps its "?" quietly, explained once under it', () => {
  mount(1440);
  const value = screen.getByTestId('multiplayer-rating-game-value');
  expect(value.textContent).toBe('1512?');
  const mark = [...value.querySelectorAll('span')].find(
    (span) => span.textContent === '?'
  );
  expect(mark?.className).toContain('text-text-secondary');
  expect(
    screen.queryByTestId('multiplayer-rating-game-provisional')
  ).toBeNull();
  const stat = screen.getByTestId('multiplayer-rating-game');
  expect(stat.querySelector('[data-component="Badge"]')).toBeNull();
  expect(
    screen.getByTestId('multiplayer-rating-game-settles').textContent
  ).toBe('the “?” goes once your rating settles');
});

// regression: provisional-rating-loud — beside Find an opponent the
// provisional rating drew an accent tag, a progress bar and a two-part
// footnote, outweighing the search itself. There is no bar, and how far
// the rating is from settling is one quiet footnote.
test('a provisional rating is quiet beside the search: no tag, no bar', () => {
  mount(1440);
  const stat = screen.getByTestId('multiplayer-rating-game');
  expect(stat.querySelector('[data-component="ProgressBar"]')).toBeNull();
  expect(screen.getByTestId('multiplayer-rating-game-games').textContent).toBe(
    '7 of 12 rated games'
  );
});

// regression: matchmaking-card-too-wide — wide, the search card spanned the
// whole 960px game column for three items, and nothing said what a found
// opponent meant for the space. A two-column card holds form-width columns
// at the column's start (a three-column one fills the column), and under
// Find an opponent it says the game opens in this space, where everyone
// can watch.
test('wide: a two-column search card keeps form-width columns and says what happens to the space', () => {
  mount(1440);
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../../pkgs/ui-root-client-ts/src/game-ui.module.css'
    ),
    'utf8'
  );
  expect(css).toContain('--game-search-split-measure: 45rem;');
  const wide = css.slice(
    css.indexOf('@container game-column (min-width: 880px)')
  );
  expect(wide).toMatch(
    /\[data-setup-split="true"\]\[data-details-across="false"\]\) \{\s*max-width: var\(--game-search-split-measure\);/
  );
  const note = screen.getByTestId('multiplayer-find-space');
  expect(note.textContent).toContain('opens in this space');
  expect(note.textContent).toContain('everyone can watch');
  // The note follows the command, in the same group.
  expect(
    screen.getByTestId('multiplayer-find').compareDocumentPosition(note) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});
