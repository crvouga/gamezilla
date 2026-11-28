/** @jsxImportSource @solidjs/web */
import { afterEach, expect, test } from 'bun:test';
import { AppThemeProvider } from '@libs/app-root-client-ts/app-theme-provider';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createMotionPreference } from '@pkgs/device-shared-ts/motion-preference';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import { cleanup, render } from '@solidjs/testing-library';
import { flush } from 'solid-js';

afterEach(cleanup);

// regression: boot-theme-flash
test('a saved light preference cannot override the product surface while reduced motion still follows the device', async () => {
  const kv = new KvImplInMemory();
  await kv.put(asKeyword('ui.prefs/color-scheme'), {
    [asKeyword('ui.prefs/value')]: 'light',
  });
  const time = createHarnessClock();
  const motion = createMotionPreference(true);
  const view = render(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <TestViewportProvider value={{ width: 320, height: 480 }}>
        <AppThemeProvider kv={kv} motion={motion}>
          <p>Shell</p>
        </AppThemeProvider>
      </TestViewportProvider>
    </ClockProvider>
  ));
  const host = view
    .getByText('Shell')
    .closest('[data-component="ThemeProvider"]');
  expect(host).toHaveAttribute('data-reduced-motion', 'true');
  await Promise.resolve();
  flush();
  expect(view.getByText('Shell').closest('[data-theme="light"]')).toBeNull();
  motion.setReduced(false);
  flush();
  expect(host).not.toHaveAttribute('data-reduced-motion');
});
