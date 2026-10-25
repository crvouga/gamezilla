import { expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import CardTableExample from '@pkgs/ui-root-client-ts/card-table.example';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';

function example() {
  const { clock, timers } = createHarnessClock();
  return render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light" fixedLayout={{ width: 390, height: 844 }}>
        <CardTableExample />
      </ThemeProvider>
    </ClockProvider>
  ));
}
const at = (testId: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;

test('the table names every seat and card in words, never by colour alone', () => {
  example();
  expect(at('example-seat-left').getAttribute('aria-label')).toBe('West');
  expect(at('example-seat-left-played').getAttribute('aria-label')).toBe('J clubs, Jack of clubs');
  expect(at('example-card-QS').getAttribute('aria-label')).toBe('Q spades, Queen of spades');
  expect(at('example-card-QS').textContent).toContain('spades');
  expect(at('example-card-QS').textContent).toContain('♠');
});

test('a card the rules allow toggles; one they do not says so and does nothing', () => {
  example();
  fireEvent.click(at('example-card-2C'));
  expect(at('example-card-2C').getAttribute('aria-pressed')).toBe('false');
  expect(at('example-card-2C').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(at('example-card-QS'));
  expect(at('example-card-QS').getAttribute('aria-pressed')).toBe('true');
});

test('the confirm action waits for the full selection', () => {
  example();
  const pass = () => at('example-pass') as HTMLButtonElement;
  expect(pass().disabled || pass().getAttribute('aria-disabled') === 'true').toBe(true);
  for (const id of ['QS', 'AS', 'KH']) fireEvent.click(at(`example-card-${id}`));
  expect(pass().disabled).toBe(false);
});

test('arrow keys, Home and End move between the cards of the hand', () => {
  example();
  const first = at('example-card-2C');
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(document.activeElement).toBe(at('example-card-9D'));
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(document.activeElement).toBe(at('example-card-KH'));
  fireEvent.keyDown(document.activeElement!, { key: 'Home' });
  expect(document.activeElement).toBe(first);
});

test('the table passes the accessibility audit', () => {
  const { container } = example();
  const failures = auditTree(container);
  expect(failures.map(formatFailure)).toEqual([]);
});
