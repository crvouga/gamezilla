/** @jsxImportSource solid-js */
/** What the Settings Work offline row tells a person about playing with others. */

import { afterEach, expect, test } from 'bun:test';
import { SettingsScreenView } from '@libs/app-root-client-ts/settings-screen-view';
import { cleanup, screen } from '@solidjs/testing-library';
import { renderChrome } from './render-chrome';

afterEach(cleanup);

function mountSettings(offline: boolean): void {
  renderChrome(() => (
    <SettingsScreenView
      theme="system"
      muted={false}
      offline={offline}
      canViewBilling={false}
      version="1.0.0"
      bugReportsWaiting={0}
      shakeToReport="unavailable"
      onShakeToReportChange={() => undefined}
      onReportBug={() => undefined}
      onOfflineChange={() => undefined}
      onNavigate={() => undefined}
    />
  ));
}

// regression: work-offline-silent-on-multiplayer
test('online, the row says turning it on pauses multiplayer', () => {
  mountSettings(false);
  expect(screen.getByText('Work offline')).toBeTruthy();
  expect(
    screen.getByText('Disconnects multiplayer; changes wait on this device')
  ).toBeTruthy();
  const toggle = screen.getByRole('switch', { name: 'Work offline' });
  expect(toggle.getAttribute('aria-checked')).toBe('false');
});

// regression: work-offline-silent-on-multiplayer
test('offline, the row says multiplayer is paused', () => {
  mountSettings(true);
  expect(
    screen.getByText('Multiplayer is off; changes wait on this device')
  ).toBeTruthy();
  const toggle = screen.getByRole('switch', { name: 'Work offline' });
  expect(toggle.getAttribute('aria-checked')).toBe('true');
});

// regression: work-offline-looks-like-a-preference
test('the switch sits in its own Connection group that says what it ends', () => {
  mountSettings(false);
  expect(screen.getByText('Connection')).toBeTruthy();
  expect(
    screen.getByText('Disconnects multiplayer; changes wait on this device')
  ).toBeTruthy();
  // Not grouped with look and sound, as if it were one more preference.
  expect(screen.queryByText('Look, sound and connection')).toBeNull();
});

// regression: work-offline-needs-a-paragraph
test('the one caption explains the switch, with no paragraph under it', () => {
  mountSettings(false);
  expect(screen.queryByText(/nobody can play with you/)).toBeNull();
  expect(screen.queryByText(/until you go back online/)).toBeNull();
});

// regression: settings-label-column-wraps — on a desktop the Connection
// group's description, "Playing with others and syncing", wrapped onto two
// lines in the label column beside its row. Every group's description is
// a short pair like its neighbours ("Look and sound"), one line there.
test('on a desktop every settings group says what it holds in a short line', () => {
  renderChrome(
    () => (
      <SettingsScreenView
        theme="system"
        muted={false}
        offline={false}
        canViewBilling={false}
        version="1.0.0"
        bugReportsWaiting={0}
        shakeToReport="unavailable"
        onShakeToReportChange={() => undefined}
        onReportBug={() => undefined}
        onOfflineChange={() => undefined}
        onNavigate={() => undefined}
      />
    ),
    { width: 1440, height: 900 }
  );
  expect(screen.getByText('Online play and sync')).toBeTruthy();
  const descriptions = [
    ...document.querySelectorAll(
      '[data-component="MenuSection"][data-layout="aside"] p'
    ),
  ].map((node) => node.textContent ?? '');
  expect(descriptions.length).toBeGreaterThan(2);
  for (const text of descriptions) expect(text.length).toBeLessThanOrEqual(24);
});
