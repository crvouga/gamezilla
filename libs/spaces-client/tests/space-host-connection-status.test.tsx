import { afterEach, expect, test } from 'bun:test';
import { SpaceHostConnectionStatus } from '@libs/spaces-client/space-host-connection-status';
import { Handles } from '@libs/test-ids-shared/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client/render';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

test('host connection changes keep their header slot and never add a notice', () => {
  // regression: space-connection-banner-layout-shift
  const [offline, setOffline] = createSignal(false);
  const { container } = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <SpaceHostConnectionStatus offline={offline()} />
    </ThemeProvider>
  ));
  const slot = container.querySelector(
    '[data-component="SpaceHostConnectionStatus"]'
  );
  expect(slot?.classList.contains('h-8')).toBe(true);
  expect(slot?.classList.contains('w-8')).toBe(true);
  expect(slot?.classList.contains('shrink-0')).toBe(true);
  setOffline(true);
  expect(
    container.querySelector('[data-component="SpaceHostConnectionStatus"]')
  ).toBe(slot);
  expect(
    container.querySelector(`[data-testid="${Handles.spaceHostOffline}"]`)
      ?.textContent
  ).toContain('The host is offline');
  expect(container.querySelector('[data-component="Notice"]')).toBeNull();
  setOffline(false);
  expect(
    container.querySelector('[data-component="SpaceHostConnectionStatus"]')
  ).toBe(slot);
  expect(slot?.children.length).toBe(0);
});
