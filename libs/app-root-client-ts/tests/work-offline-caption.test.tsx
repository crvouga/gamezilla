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
      perfEnabled={false}
      offline={offline}
      canViewBilling={false}
      version="1.0.0"
      onOfflineChange={() => undefined}
      onNavigate={() => undefined}
    />
  ));
}

// regression: work-offline-silent-on-multiplayer
test('online, the row says games and changes sync', () => {
  mountSettings(false);
  expect(screen.getByText('Online — games and changes sync')).toBeTruthy();
});

// regression: work-offline-silent-on-multiplayer
test('offline, the row says games with others pause', () => {
  mountSettings(true);
  expect(screen.getByText('Offline — games with others pause')).toBeTruthy();
});
