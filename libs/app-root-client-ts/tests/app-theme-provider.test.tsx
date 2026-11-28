/** @jsxImportSource @solidjs/web */
import { afterEach, expect, test } from 'bun:test';
import { AppThemeProvider } from '@libs/app-root-client-ts/app-theme-provider';
import {
  BrowserOpening,
  OpeningContent,
} from '@libs/app-root-client-ts/browser-opening';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createMotionPreference } from '@pkgs/device-shared-ts/motion-preference';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import { cleanup, render, waitFor } from '@solidjs/testing-library';

import { createSignal, flush, Show } from 'solid-js';

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

test('changing appearance while the account opens survives the handoff', async () => {
  const shell = document.createElement('section');
  shell.dataset['startupShell'] = '';
  const root = document.createElement('div');
  document.body.append(shell, root);
  const kv = new KvImplInMemory();
  const time = createHarnessClock();
  const [ready, setReady] = createSignal(false);
  const view = render(
    () => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <BrowserOpening root={root}>
          <AppThemeProvider kv={kv} motion={createMotionPreference()}>
            <Show when={ready()}>
              <OpeningContent>
                <p>Appearance</p>
              </OpeningContent>
            </Show>
          </AppThemeProvider>
        </BrowserOpening>
      </ClockProvider>
    ),
    { container: root }
  );
  try {
    document.documentElement.setAttribute('data-startup-preference', 'dark');
    shell.dispatchEvent(new CustomEvent('startup-theme-change'));
    setReady(true);
    flush();
    expect(shell.isConnected).toBe(false);
    expect(
      view.getByText('Appearance').closest('[data-component="ThemeProvider"]')
    ).toHaveAttribute('data-theme', 'dark');
    expect(await kv.get(asKeyword('ui.prefs/color-scheme'))).toEqual({
      [asKeyword('ui.prefs/value')]: 'dark',
    });
  } finally {
    view.unmount();
    shell.remove();
    root.remove();
    document.documentElement.removeAttribute('data-startup-preference');
  }
});
