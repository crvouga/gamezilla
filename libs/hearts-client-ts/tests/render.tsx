/** @jsxImportSource solid-js */
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import type { JSX } from 'solid-js';

/** `ui` inside the providers a game board may read, on a phone-sized host. */
export function renderBoard(ui: () => JSX.Element) {
  const { clock, timers } = createHarnessClock();
  return renderWithI18n(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        {ui()}
      </ThemeProvider>
    </ClockProvider>
  ));
}
/** The element carrying `testId`; fails the test when there is none. */
export function byTestId(testId: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-testid="${testId}"]`
  );
  if (element === null) throw new Error(`No element ${testId}`);
  return element;
}
