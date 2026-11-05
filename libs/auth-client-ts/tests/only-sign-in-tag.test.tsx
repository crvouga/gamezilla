/** @jsxImportSource solid-js */
/** The "Only sign-in" tag sits on its row's middle, as a button there does. */

import { afterEach, expect, test } from 'bun:test';
import { RemoveMethodControl } from '@libs/auth-client-ts/sign-in-method-row';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';

afterEach(cleanup);

// regression: account-only-sign-in-tag-top-aligned
test('the only sign-in tag has its own box, which the row centres', () => {
  const { container } = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <RemoveMethodControl
        method="google"
        removable={false}
        onRemove={() => undefined}
      />
    </ThemeProvider>
  ));
  const tag = container.querySelector(
    `[data-testid="${Handles.accountUnlinkProvider('google')}"]`
  );
  expect(tag?.getAttribute('data-component')).toBe('Badge');
  // A tag pins itself to the top of whatever holds it (`self-start`); held
  // directly by the row it sat on the row's top line.
  const box = tag?.parentElement;
  expect(box?.getAttribute('data-component')).toBe('StackVertical');
  expect(box?.className).toContain('justify-center');
});
