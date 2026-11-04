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
test('online, the row says turning it on pauses games with others', () => {
  mountSettings(false);
  expect(
    screen.getByText('Online — turn on to pause syncing and games with others')
  ).toBeTruthy();
});

// regression: work-offline-silent-on-multiplayer
test('offline, the row says turning it off plays with others again', () => {
  mountSettings(true);
  expect(
    screen.getByText('Offline — turn off to sync and play with others again')
  ).toBeTruthy();
});
