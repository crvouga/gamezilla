import { expect, test } from 'bun:test';
import { BootLoadingShell } from '@libs/app-root-client-ts/boot-loading-shell';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { SPINNER_PX, type SpinnerSize } from '@pkgs/ui-root-client-ts/spinner';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { STARTUP_INDICATOR_PX } from '@pkgs/ui-root-shared-ts/startup-shell-check';

function spinnerSizes(): readonly SpinnerSize[] {
  return [...document.querySelectorAll('[data-component="Spinner"]')].map(
    (el) => el.getAttribute('data-size') as SpinnerSize
  );
}

// regression: boot-spinner-size-jump
test('the indicator keeps one size from first paint to the first screen load', () => {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="light">
      <BootLoadingShell />
      <LoadingState />
    </ThemeProvider>
  ));
  const [boot, screen] = spinnerSizes();
  if (boot === undefined || screen === undefined) {
    throw new Error('expected the boot and the screen spinner');
  }
  expect(boot).toBe(screen);
  expect(SPINNER_PX[boot]).toBe(STARTUP_INDICATOR_PX);
});

// regression: boot-spinner-size-jump
test('the boot indicator stays centered on the viewport, like the static boot screen', () => {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark">
      <BootLoadingShell />
    </ThemeProvider>
  ));
  const spinner = document.querySelector('[data-component="Spinner"]');
  const layer = spinner?.closest('[data-component="Layer"]');
  expect(layer?.getAttribute('data-inset')).toBe('viewport');
  expect(layer?.classList.contains('fixed')).toBe(true);
  expect(layer?.classList.contains('inset-0')).toBe(true);
});
