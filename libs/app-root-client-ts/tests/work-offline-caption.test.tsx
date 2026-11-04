/** @jsxImportSource solid-js */
/** What the Settings Offline mode row tells a person about playing with others. */

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
  expect(screen.getByText('Offline mode')).toBeTruthy();
  expect(screen.getByText('Pause syncing and multiplayer')).toBeTruthy();
  const toggle = screen.getByRole('switch', { name: 'Offline mode' });
  expect(toggle.getAttribute('aria-checked')).toBe('false');
});

// regression: work-offline-silent-on-multiplayer
test('offline, the row says multiplayer is paused', () => {
  mountSettings(true);
  expect(screen.getByText('Syncing and multiplayer are paused')).toBeTruthy();
  const toggle = screen.getByRole('switch', { name: 'Offline mode' });
  expect(toggle.getAttribute('aria-checked')).toBe('true');
});
