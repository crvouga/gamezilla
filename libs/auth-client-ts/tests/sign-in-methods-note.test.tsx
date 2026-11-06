/** @jsxImportSource solid-js */
/** What Remove does is said inside the sign-in methods card, as its last row. */

import { afterEach, expect, test } from 'bun:test';
import { SignInMethodsSection } from '@libs/auth-client-ts/sign-in-methods-section';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

// regression: account-sign-in-note-outside-card — "Your account needs at
// least one way to sign in" sat under the methods card as loose text, so it
// read as the start of the next section. It is the card's last row.
test('the only-method note is the methods card last row, on phone and desktop', () => {
  for (const width of [390, 1440]) {
    const time = createHarnessClock();
    renderWithI18n(() => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <ThemeProvider colorScheme="light" fixedLayout={{ width, height: 900 }}>
          <SignInMethodsSection
            methods={{
              status: 'ready',
              syncFailed: false,
              identities: [
                {
                  provider: 'google',
                  email: 'avery@example.com',
                  emailVerified: true,
                  isPrivateEmail: false,
                  emailForwarding: true,
                },
              ],
              providers: ['google', 'apple'],
            }}
            removing={null}
            onConnect={() => Promise.resolve()}
            onRemove={() => undefined}
            onCancelRemove={() => undefined}
            onConfirmRemove={() => Promise.resolve()}
          />
        </ThemeProvider>
      </ClockProvider>
    ));
    const note = screen.getByText(/needs at least one way to sign in/);
    const card = note.closest('[data-component="MenuList"]');
    expect(card).not.toBeNull();
    expect(
      card?.contains(screen.getByTestId(Handles.accountSignInMethod('google')))
    ).toBe(true);
    const rows = card?.querySelectorAll(':scope > .panelItem') ?? [];
    expect(rows[rows.length - 1]?.contains(note)).toBe(true);
    cleanup();
  }
});
