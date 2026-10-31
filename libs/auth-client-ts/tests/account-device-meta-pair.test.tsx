import { afterEach, expect, test } from 'bun:test';
// regression: isolated-auth-component-entrypoint
import { AccountDeviceMetaPair } from '@libs/auth-client-ts/account-device-meta-pair';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';

afterEach(cleanup);

test('a device meta pair caps its value without an invalid inline max-width', () => {
  // regression: account-device-meta-max-width-unit
  const { container } = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <AccountDeviceMetaPair
        label="Last seen"
        valueAtom={<span data-testid="meta-value">{'2026-10-21 09:41'}</span>}
      />
    </ThemeProvider>
  ));
  for (const node of container.querySelectorAll('[style]')) {
    const style = node.getAttribute('style') ?? '';
    expect(style).not.toContain('%px');
    expect(style).not.toContain('max-width');
  }
  const value = container.querySelector('[data-testid="meta-value"]');
  expect(value).not.toBeNull();
  const capped = value?.closest('.max-w-9\\/20');
  expect(capped).not.toBeNull();
  expect(capped?.textContent).toContain('2026-10-21 09:41');
});
