import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  handPlace,
  handSpan,
  handSplit,
} from '@pkgs/ui-root-client-ts/card-table';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import CardTableExample from '../../ui-root-client-ts/src/card-table/card-table.example';

function example() {
  const { clock, timers } = createHarnessClock();
  return render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <CardTableExample />
      </ThemeProvider>
    </ClockProvider>
  ));
}
const at = (testId: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(
    `[data-testid="${testId}"]`
  );
  if (element === null) throw new Error(`nothing is ${testId}`);
  return element;
};
const focused = (): Element => document.activeElement ?? document.body;

test('the table names every seat and card in words, never by colour alone', () => {
  example();
  expect(at('example-seat-left').getAttribute('aria-label')).toBe('West');
  expect(at('example-seat-left-played').getAttribute('aria-label')).toBe(
    'J clubs, Jack of clubs'
  );
  expect(at('example-card-QS').getAttribute('aria-label')).toBe(
    'Q spades, Queen of spades'
  );
  expect(at('example-card-QS').textContent).toContain('spades');
  expect(at('example-card-QS').textContent).toContain('♠');
});

// regression: card-table-refusal-silent
test('a card the rules allow toggles; one they do not says why and does nothing', () => {
  example();
  expect(at('example-card-table-refusal').textContent).toBe('');
  fireEvent.click(at('example-card-2C'));
  expect(at('example-card-2C').getAttribute('aria-pressed')).toBe('false');
  expect(at('example-card-2C').getAttribute('aria-disabled')).toBe('true');
  expect(at('example-card-table-refusal').textContent).toBe(
    'You keep the two of clubs.'
  );
  expect(at('example-card-table-refusal').getAttribute('role')).toBe('status');
  fireEvent.click(at('example-card-QS'));
  expect(at('example-card-QS').getAttribute('aria-pressed')).toBe('true');
});

// regression: card-table-play-toggles
test('a card played at once is a plain button, not a toggle', () => {
  example();
  expect(at('example-play-card-QS').hasAttribute('aria-pressed')).toBe(false);
  fireEvent.click(at('example-play-card-9D'));
  expect(at('example-play-table-refusal').textContent).toBe(
    'You must follow suit with a spade.'
  );
  expect(
    document.querySelector('[data-testid="example-play-card-9D"]')
  ).not.toBeNull();
});

// regression: card-table-focus-lost-on-play
test('focus stays in the hand when the card played leaves it, and Tab returns to where the person was', () => {
  example();
  const queen = at('example-play-card-QS');
  queen.focus();
  expect(queen.tabIndex).toBe(0);
  expect(at('example-play-card-2C').tabIndex).toBe(-1);
  fireEvent.click(queen);
  expect(
    document.querySelector('[data-testid="example-play-card-QS"]')
  ).toBeNull();
  // The ace of spades took the queen's place in the row.
  expect(document.activeElement).toBe(at('example-play-card-AS'));
  expect(at('example-play-card-AS').tabIndex).toBe(0);
});

// regression: card-table-pass-vanishes
test('a sent pass shows it is in progress and cannot be sent twice', () => {
  example();
  for (const id of ['QS', 'AS', 'KH'])
    fireEvent.click(at(`example-card-${id}`));
  const pass = () => at('example-pass') as HTMLButtonElement;
  fireEvent.click(pass());
  expect(pass().getAttribute('aria-busy')).toBe('true');
  expect(at('example-card-QS').getAttribute('aria-pressed')).toBe('true');
});

test('the confirm action waits for the full selection', () => {
  example();
  const pass = () => at('example-pass') as HTMLButtonElement;
  expect(
    pass().disabled || pass().getAttribute('aria-disabled') === 'true'
  ).toBe(true);
  for (const id of ['QS', 'AS', 'KH'])
    fireEvent.click(at(`example-card-${id}`));
  expect(pass().disabled).toBe(false);
});

test('arrow keys, Home and End move between the cards of the hand', () => {
  example();
  const first = at('example-card-2C');
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(document.activeElement).toBe(at('example-card-9D'));
  fireEvent.keyDown(focused(), { key: 'End' });
  expect(document.activeElement).toBe(at('example-card-KH'));
  fireEvent.keyDown(focused(), { key: 'Home' });
  expect(document.activeElement).toBe(first);
});

test('the table passes the accessibility audit', () => {
  const { container } = example();
  const failures = auditTree(container);
  expect(failures.map(formatFailure)).toEqual([]);
});

// regression: hearts-cards-text-tiles — cards were text tiles in two
// wrapped rows, a chosen card a faint outline, and a played card sat beside
// its seat's name instead of on the table.
test('cards are drawn as cards in one flat hand, and the trick sits on the table', () => {
  example();
  const queen = at('example-card-QS');
  // The corner index leads the face: the rank, then the large pip, then the name.
  expect(queen.firstElementChild?.textContent).toBe('Q');
  // Six cards lie in one row, each a step further along than the last.
  const hand = at('example-card-table-hand');
  expect(hand.querySelectorAll('button')).toHaveLength(6);
  expect(hand.style.getPropertyValue('--hand-span')).toBe('5');
  expect(at('example-card-2C').style.getPropertyValue('--hand-row')).toBe('0');
  expect(at('example-card-2C').style.getPropertyValue('--hand-step')).toBe('0');
  expect(at('example-card-KH').style.getPropertyValue('--hand-row')).toBe('0');
  expect(at('example-card-KH').style.getPropertyValue('--hand-step')).toBe('5');
  // The played card is on the table, on its seat's side, not in the seat's plate.
  const played = at('example-seat-left-played');
  expect(played.closest('section')).toBeNull();
  expect(played.parentElement?.getAttribute('data-position')).toBe('left');
  expect(at('example-seat-left').textContent).not.toContain('J');
});

// regression: hearts-seats-shown-twice — a seat showed its name and every
// fact in a bordered box while the same player showed again above the
// table. A seat holds the person the host lends it, keeps its name for a
// listener, and says its phase (`Passed`) only to a listener when the
// person's own tags already show it.
test('a seat holds the person lent to it and keeps its name and phase for a listener', () => {
  example();
  const north = at('example-seat-top');
  expect(north.getAttribute('aria-label')).toBe('North');
  expect(north.getAttribute('data-player')).toBe('true');
  expect(at('example-seat-top-player').textContent).toContain('morgan');
  expect(north.textContent).toContain('Passed');
  expect(north.textContent).toContain('13 cards');
  // A seat with no person lent shows its own name.
  expect(at('example-seat-left').textContent).toContain('West');
});

const css = (slice: string): string =>
  readFileSync(
    join(import.meta.dirname, `../../ui-root-client-ts/src/${slice}`),
    'utf8'
  );

/** The body of the first rule opened by `head` in `sheet`. */
function rule(sheet: string, head: string): string {
  const start = sheet.indexOf(head);
  if (start < 0) throw new Error(`no rule ${head}`);
  return sheet.slice(start, sheet.indexOf('}', start));
}

// regression: hearts-phone-hand-overflows — on a 390px phone the thirteen
// card hand ran past the screen's right edge: every card kept 30px in view,
// so the row was 412px wide in a 342px hand, the J and Q cut off with no
// sign the row scrolled. The hand fits its row and never scrolls.
// regression: hearts-phone-hand-thin-strips — the one row that fitted left
// each of thirteen cards a 24px strip on a phone, too thin to read or tap.
// regression: hearts-hand-cards-overlap — two overlapping rows then covered
// the upper row's centre pips on a phone, and the wide fan left each card a
// 20px corner. Cards never overlap: each steps by its own width and a gap,
// is as wide as the longer row leaves it (about 46px of thirteen on a
// phone, 72px on a wide table), and the lower row starts a card's height
// and a gap below the upper, the gap wider than a chosen card's 8px lift
// and 3px ring.
test('a hand of thirteen cards lies in two rows of whole cards that never overlap', () => {
  const sheet = css('card-table/card-table.module.css');
  const row = rule(sheet, '.hand {\n  --hand-gap');
  expect(row).not.toMatch(/overflow-x:\s*(auto|scroll)/);
  expect(row).toMatch(/--hand-gap:\s*var\(--ui-space-1\);/);
  expect(row).toMatch(/--hand-row-gap:\s*var\(--ui-space-3\);/);
  const card = rule(sheet, '.hand > .card {');
  // Each card is as wide as the row leaves it, at most 72px…
  expect(card).toMatch(
    /--card-w:\s*min\(\s*72px,\s*\(100cqw - var\(--hand-span\) \* var\(--hand-gap\)\) \/\s*\(var\(--hand-span\) \+ 1\)\s*\);/
  );
  // …and steps along by its own width and the gap, never less.
  expect(card).toMatch(
    /--step:\s*calc\(var\(--card-w\) \+ var\(--hand-gap\)\);/
  );
  expect(card).toMatch(
    /margin-top:\s*calc\(\s*var\(--hand-row\) \*\s*\(var\(--card-w\) \* 1\.4 \+ var\(--hand-row-gap\)\)\s*\);/
  );
  expect(card).toMatch(
    /margin-inline-start:\s*calc\(var\(--hand-step\) \* var\(--step\)\);/
  );
  expect(card).not.toMatch(/rotate|--fan/);
  // A chosen card lifts 8px with a 3px ring: 11px, inside the 12px row gap.
  const chosen = rule(sheet, 'button.card[aria-pressed="true"] {');
  expect(chosen).toMatch(/translateY\(calc\(-1 \* var\(--ui-space-2\)\)\)/);
  expect(chosen).toMatch(/0 0 0 3px var\(--ui-color-tint\)/);
  expect(8 + 3).toBeLessThan(12);
  // A hand of one suit has no boundary to break at: it splits at the middle.
  const one = (count: number): string[] => Array<string>(count).fill('hearts');
  const places = Array.from({ length: 13 }, (_, at) => handPlace(at, one(13)));
  expect(places.filter((place) => place.row === 0)).toHaveLength(7);
  expect(places.filter((place) => place.row === 1)).toHaveLength(6);
  // The lower row sits half a step along, between the upper row's cards.
  expect(places[7]).toEqual({ row: 1, step: 0.5 });
  // Thirteen cards on a 390px phone's 350px row are 46px or wider; on a
  // 320px phone's 280px row still 36px.
  const span = handSpan(one(13));
  const width = (row: number) => Math.min(72, (row - span * 4) / (span + 1));
  expect(width(350)).toBeGreaterThanOrEqual(46);
  expect(width(280)).toBeGreaterThanOrEqual(36);
  expect(width(532)).toBe(72);
  // An even hand's lower row ends half a step past the upper's last card.
  expect(handSpan(one(8))).toBe(3.5);
  // Seven cards or fewer lie in one row.
  expect(handPlace(6, one(7))).toEqual({ row: 0, step: 6 });
  example();
  const hand = document.querySelector<HTMLElement>('[role="toolbar"]');
  if (hand === null) throw new Error('No hand');
  const count = hand.querySelectorAll('button').length;
  const suits = [...hand.querySelectorAll('button')].map(
    (button) => button.getAttribute('data-suit') ?? ''
  );
  expect(suits).toHaveLength(count);
  expect(hand.style.getPropertyValue('--hand-span')).toBe(
    String(handSpan(suits))
  );
});

// regression: hearts-hand-splits-suit — thirteen cards broke into rows of
// seven and six by count alone, so the hearts ran on from the upper row
// into the lower and a suit was read in two places. The rows now break at
// the suit boundary nearest the middle where both rows still fit (clubs,
// diamonds and spades over the hearts), the shorter row centred, and at
// the middle only when no boundary fits.
test('a two-row hand breaks at a suit boundary where one fits', () => {
  const hand = [
    ...Array<string>(2).fill('clubs'),
    'diamonds',
    ...Array<string>(3).fill('spades'),
    ...Array<string>(7).fill('hearts'),
  ];
  expect(handSplit(hand)).toBe(6);
  const places = hand.map((_, at) => handPlace(at, hand));
  expect(places.slice(0, 6).every((place) => place.row === 0)).toBe(true);
  expect(places.slice(6).every((place) => place.row === 1)).toBe(true);
  // The upper row of six sits centred over the lower row of seven.
  expect(places[0]).toEqual({ row: 0, step: 0.5 });
  expect(places[6]).toEqual({ row: 1, step: 0 });
  expect(handSpan(hand)).toBe(6);
  // No row ever holds more than seven: a boundary that would leave eight
  // is passed over for the middle.
  const lopsided = ['clubs', 'clubs', ...Array<string>(11).fill('hearts')];
  expect(handSplit(lopsided)).toBe(7);
});

// regression: hearts-seat-name-truncated — a phone's side seat at the Hearts
// table cut "jordan_plays" to "jordan_pla…". A narrow seat sets a name a
// size smaller and lets it take a second line; it is never cut.
test("a narrow seat's name is set smaller and wraps, never cut", () => {
  const sheet = css('game-table-seat/game-table-seat.module.css');
  const name = rule(sheet, '.name {');
  expect(name).toMatch(/font-size:\s*var\(--ui-font-size-sm\);/);
  expect(name).toMatch(/-webkit-line-clamp:\s*2;/);
  expect(name).not.toMatch(/white-space:\s*nowrap|text-overflow/);
});

// regression: hearts-phone-table-crowds-hand — on a 390px phone the table's
// four plates stood about 360px tall (the seats above and below each a
// stack of person over facts), squeezing the hand and its Pass button to
// the screen's bottom edge. A phone's table sets the seats above and below
// as one strip each, the person beside their facts, and every plate a step
// shallower; a wide table keeps its plates as they were.
test("a phone's table sets the seats above and below as strips, the person beside the facts", () => {
  const sheet = css('card-table/card-table.module.css');
  // The table's own width decides, never a seat's (a seat is a container
  // too, and every seat is narrower than 30rem, even on a wide table).
  expect(rule(sheet, '.root {')).toMatch(
    /container:\s*card-table \/ inline-size;/
  );
  const start = sheet.indexOf('@container card-table not (min-width: 30rem) {');
  expect(start).toBeGreaterThan(-1);
  const phone = sheet.slice(start, sheet.indexOf('\n}\n', start));
  expect(phone).toMatch(
    /\.seat\[data-player="true"\] \{\s*padding: var\(--ui-space-1\);/
  );
  const strip = rule(
    phone,
    '.seat[data-player="true"][data-position="top"],\n  .seat[data-player="true"][data-position="bottom"] {'
  );
  expect(strip).toMatch(/flex-direction:\s*row;/);
  expect(strip).toMatch(/max-width:\s*none;/);
  // The facts stack beside the person, never under it.
  expect(phone).toMatch(
    /\[data-position="bottom"\] \.facts \{\s*flex: 0 0 auto;\s*flex-direction: column;/
  );
  // The hand keeps its cards side by side and whole.
  expect(rule(sheet, '.hand > .card {')).not.toMatch(/rotate|--fan/);
});
