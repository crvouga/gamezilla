import { afterEach, expect, test } from 'bun:test';
import { ConnectionStatusIndicator } from '@libs/app-root-client/connection-notice';
import { Handles } from '@libs/test-ids-shared/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client/render';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

test('connection loss changes only the contents of a reserved header slot', () => {
  // regression: space-connection-banner-layout-shift
  const [missing, setMissing] = createSignal(false);
  const { container } = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <ConnectionStatusIndicator missing={missing()} />
    </ThemeProvider>
  ));
  const slot = container.querySelector('[data-component="StatusIconSlot"]');
  expect(slot?.classList.contains('h-8')).toBe(true);
  expect(slot?.classList.contains('w-8')).toBe(true);
  expect(slot?.classList.contains('shrink-0')).toBe(true);
  expect(slot?.children.length).toBe(0);
  setMissing(true);
  expect(container.querySelector('[data-component="StatusIconSlot"]')).toBe(
    slot
  );
  expect(
    container.querySelector(
      `[data-testid="${Handles.statusConnectionMissing}"]`
    )?.textContent
  ).toContain('Saved content and local games remain available');
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelector('[data-component="Notice"]')).toBeNull();
  setMissing(false);
  expect(container.querySelector('[data-component="StatusIconSlot"]')).toBe(
    slot
  );
  expect(slot?.children.length).toBe(0);
});
