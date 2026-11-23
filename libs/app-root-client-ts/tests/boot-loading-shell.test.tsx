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
