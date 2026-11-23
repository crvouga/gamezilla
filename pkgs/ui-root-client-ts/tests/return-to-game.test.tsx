/** @jsxImportSource solid-js */
/**
 * The way back to an unfinished game: one command that goes there, docked
 * like the miniplayer or inline in place of a command it replaces.
 */

import { afterEach, expect, test } from 'bun:test';
import { ReturnToGame } from '@pkgs/ui-root-client-ts/return-to-game';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(
  width: number,
  placement: 'dock' | 'inline' | undefined,
  onReturn: () => void = () => undefined
): Element {
  const { container } = render(() => (
    <ThemeProvider colorScheme="light" fixedLayout={{ width, height: 900 }}>
      <ReturnToGame
        title="Your custom game is under way"
        caption="Chess · Robin's space"
        action="Return to the custom game"
        kind="custom"
        placement={placement}
        testId="return-to-game"
        onReturn={onReturn}
      />
    </ThemeProvider>
  ));
  const root = container.querySelector('[data-testid="return-to-game"]');
  if (root === null) throw new Error('ReturnToGame not rendered');
  return root;
}

test('its one command returns to the game', () => {
  let returned = 0;
  const root = mount(390, undefined, () => {
    returned += 1;
  });
  const go = root.querySelector('[data-testid="return-to-game-go"]');
  if (go === null) throw new Error('no command');
  expect(go.textContent).toContain('Return to the custom game');
  fireEvent.click(go);
  expect(returned).toBe(1);
  expect(root.getAttribute('data-kind')).toBe('custom');
});

test('docked: flush and stacked on compact, a card-shaped row on wide', () => {
  const compact = mount(390, 'dock');
  expect(compact.getAttribute('data-placement')).toBe('dock');
  expect(compact.classList.contains('rounded-none')).toBe(true);
  // The words keep the bar's width; the command runs under them.
  expect(compact.classList.contains('flex-col')).toBe(true);
  cleanup();
  const wide = mount(1440, 'dock');
  expect(wide.classList.contains('rounded-card')).toBe(true);
  expect(wide.classList.contains('flex-row')).toBe(true);
});

test('inline: a card whose command runs its full width', () => {
  const root = mount(390, 'inline');
  expect(root.getAttribute('data-placement')).toBe('inline');
  expect(root.classList.contains('flex-col')).toBe(true);
  expect(root.classList.contains('rounded-card')).toBe(true);
});
