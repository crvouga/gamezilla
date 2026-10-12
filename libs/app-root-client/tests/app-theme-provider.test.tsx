/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { AppThemeProvider } from '@libs/app-root-client/app-theme-provider';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createMotionPreference } from '@pkgs/device-shared/motion-preference';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import { KvImplInMemory } from '@pkgs/kv-root-shared/impl-in-memory';
import { TestViewportProvider } from '@pkgs/ui-root-client/test-viewport';
import { cleanup, render, waitFor } from '@solidjs/testing-library';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});

async function mountWith(stored: 'light' | 'dark', painted: 'light' | 'dark') {
  const kv = new KvImplInMemory();
  await kv.put(asKeyword('ui.prefs/color-scheme'), {
    [asKeyword('ui.prefs/value')]: stored,
  });
  // What `index.html` set before the application loaded.
  document.documentElement.setAttribute('data-theme', painted);
  const harness = createHarnessClock();
  const view = render(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <TestViewportProvider value={{ width: 320, height: 480 }}>
        <AppThemeProvider kv={kv} motion={createMotionPreference()}>
          <p>Shell</p>
        </AppThemeProvider>
      </TestViewportProvider>
    </ClockProvider>
  ));
  const scheme = (): string | null | undefined =>
    view
      .getByText('Shell')
      .closest('[data-component="ThemeProvider"]')
      ?.getAttribute('data-theme');
  return { scheme };
}

// regression: boot-theme-flash
test.each(['light', 'dark'] as const)(
  'the first frame is the %s theme the page already painted',
  async (stored) => {
    const view = await mountWith(stored, stored);
    expect(view.scheme()).toBe(stored);
    expect(document.documentElement.getAttribute('data-theme')).toBe(stored);
    await waitFor(() => expect(view.scheme()).toBe(stored));
  }
);

test('the stored theme takes over once it is read', async () => {
  const view = await mountWith('light', 'dark');
  expect(view.scheme()).toBe('dark');
  await waitFor(() => expect(view.scheme()).toBe('light'));
});
