import { afterEach, expect, test } from 'bun:test';
import {
  type ConnectionCause,
  resolveConnectionCause,
} from '@libs/app-root-client-ts/connection-cause';
import { ConnectionStatusIndicator } from '@libs/app-root-client-ts/connection-notice';
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

function mountIndicator(initial: ConnectionCause) {
  const [cause, setCause] = createSignal<ConnectionCause>(initial);
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <ConnectionStatusIndicator cause={cause()} />
    </ThemeProvider>
  ));
  const noticeText = (): string | null | undefined =>
    view.container.querySelector(
      `[data-testid="${Handles.statusConnectionMissing}"]`
    )?.textContent;
  return { ...view, setCause, noticeText };
}

test('connection loss changes only the contents of a reserved header slot', () => {
  // regression: space-connection-banner-layout-shift
  const view = mountIndicator('connected');
  const slot = view.container.querySelector(
    '[data-component="StatusIconSlot"]'
  );
  expect(slot?.classList.contains('h-8')).toBe(true);
  expect(slot?.classList.contains('w-8')).toBe(true);
  expect(slot?.classList.contains('shrink-0')).toBe(true);
  expect(slot?.children.length).toBe(0);
  view.setCause('deviceOffline');
  expect(
    view.container.querySelector('[data-component="StatusIconSlot"]')
  ).toBe(slot);
  expect(view.noticeText()).toContain('kept on this device');
  expect(view.container.querySelector('[role="alert"]')).toBeNull();
  expect(view.container.querySelector('[data-component="Notice"]')).toBeNull();
  view.setCause('connected');
  expect(
    view.container.querySelector('[data-component="StatusIconSlot"]')
  ).toBe(slot);
  expect(slot?.children.length).toBe(0);
});

test('an offline device is told it is offline, not that the product is out of reach', () => {
  const view = mountIndicator('deviceOffline');
  expect(view.noticeText()).toContain('You’re offline');
  expect(view.noticeText()).not.toContain(`${PRODUCT_NAME} can’t be reached`);
});

test('the product out of reach says it is not the person’s doing and nothing is lost', () => {
  const view = mountIndicator('unreachable');
  expect(view.noticeText()).toContain(
    `${PRODUCT_NAME} can’t be reached right now`
  );
  expect(view.noticeText()).toContain('This isn’t something you did');
  expect(view.noticeText()).toContain('kept on this device');
  view.setCause('checking');
  expect(view.noticeText()).toContain(
    `${PRODUCT_NAME} can’t be reached right now`
  );
});

test('the cause separates the work-offline choice, the device and the product', () => {
  const base = {
    workingOffline: false,
    deviceOnline: true,
    origin: 'available',
    syncLive: false,
  } as const;
  expect(resolveConnectionCause(base)).toBe('connected');
  expect(resolveConnectionCause({ ...base, workingOffline: true })).toBe(
    'workingOffline'
  );
  expect(
    resolveConnectionCause({
      ...base,
      deviceOnline: false,
      origin: 'unavailable',
    })
  ).toBe('deviceOffline');
  expect(resolveConnectionCause({ ...base, origin: 'unavailable' })).toBe(
    'unreachable'
  );
  expect(resolveConnectionCause({ ...base, origin: 'probing' })).toBe(
    'checking'
  );
  expect(
    resolveConnectionCause({ ...base, origin: 'unavailable', syncLive: true })
  ).toBe('connected');
});
