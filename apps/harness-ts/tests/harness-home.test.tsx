/** @jsxImportSource @solidjs/web */

import { afterEach, expect, test } from 'bun:test';
import { setupI18n } from '@lingui/core';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { HarnessHome } from '@pkgs/harness-console-client-ts/harness-home';
import { harnessPanels } from '@pkgs/harness-console-shared-ts/harness-windows';
import { I18nProvider } from '@pkgs/lingui-solid-client-ts/runtime';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { type JSX, render } from '@solidjs/web';

let dispose: (() => void) | null = null;
afterEach(() => {
  dispose?.();
  dispose = null;
  document.body.replaceChildren();
});

function mount(ui: () => JSX.Element): void {
  const time = createHarnessClock();
  dispose = render(
    () => (
      <I18nProvider i18n={setupI18n({ locale: 'en', messages: { en: {} } })}>
        <ThemeProvider
          colorScheme="light"
          fixedLayout={{ width: 1024, height: 768 }}
        >
          <ClockProvider clock={time.clock} timers={time.timers}>
            <OverlayPortalProvider>
              <SurfaceStackProvider>{ui()}</SurfaceStackProvider>
            </OverlayPortalProvider>
          </ClockProvider>
        </ThemeProvider>
      </I18nProvider>
    ),
    document.body
  );
}

const rows = (part: string): (string | null)[] =>
  [...document.querySelectorAll(`[data-harness-part="${part}"]`)].map(
    (row) => row.getAttribute('data-view-id') ?? row.getAttribute('data-tool')
  );

test('the harness app lists every instance in one group, then the emulators, and leads to each tool', () => {
  const shown: string[] = [];
  const opened: string[] = [];
  mount(() => (
    <HarnessHome
      panels={harnessPanels({
        clients: ['alice'],
        servers: ['server-a'],
        rooms: [],
      })}
      emulators={[
        { id: 'emulator:google', title: 'Google sign-in' },
        { id: 'emulator:notifications', title: 'Notifications' },
      ]}
      onShow={(view) => shown.push(view)}
      onOpen={(tool) => opened.push(tool)}
    />
  ));
  expect(rows('home-view')).toEqual([
    'client:alice',
    'lb',
    'server:server-a',
    'events',
    'emulator:google',
    'emulator:notifications',
  ]);
  expect(rows('home-tool')).toEqual(['nodes', 'snapshots', 'commands']);
  const text = document.body.textContent ?? '';
  expect(text).toContain('Instances');
  expect(text).not.toContain('Behind the apps');
  for (const row of document.querySelectorAll<HTMLElement>(
    '[data-view-id="server:server-a"], [data-tool="nodes"]'
  ))
    row.click();
  expect(shown).toEqual(['server:server-a']);
  expect(opened).toEqual(['nodes']);
});

test('a world with no client and no server still has the balancer and pub/sub to show', () => {
  mount(() => (
    <HarnessHome
      panels={harnessPanels({ clients: [], servers: [], rooms: [] })}
      emulators={[]}
      onShow={() => undefined}
      onOpen={() => undefined}
    />
  ));
  expect(rows('home-view')).toEqual(['lb', 'events']);
});
