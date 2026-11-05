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
