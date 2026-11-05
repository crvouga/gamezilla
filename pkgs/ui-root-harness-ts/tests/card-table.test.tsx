import { expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
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
test('cards are drawn as cards in one fanned hand, and the trick sits on the table', () => {
  example();
  const queen = at('example-card-QS');
  // The corner index leads the face: the rank, then the large pip, then the name.
  expect(queen.firstElementChild?.textContent).toBe('Q');
  // One fanned row: every card knows its place from the middle of the hand.
  const hand = at('example-card-table-hand');
  expect(hand.style.getPropertyValue('--hand-count')).toBe('6');
  expect(at('example-card-2C').style.getPropertyValue('--fan')).toBe('-2.5');
  expect(at('example-card-KH').style.getPropertyValue('--fan')).toBe('2.5');
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
