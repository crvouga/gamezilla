import { expect, test } from 'bun:test';
import { SpacesLobbyContent } from '@libs/spaces-client/spaces-notices';
import { Handles } from '@libs/test-ids-shared/handles';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage-root-client/solid';
import { SecureStorageStore } from '@pkgs/secure-storage-root-shared/secure-storage-store';
import { SyncEngineProvider } from '@pkgs/sync-engine-client/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client/sync-engine-port';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { render, screen } from '@solidjs/testing-library';
import fc from 'fast-check';

function mountLobby() {
  let rows: readonly { hosted: number }[] = [];
  let hydrated = false;
  const listeners = new Set<() => void>();
  const engine = {
    watch: () => ({
      getSnapshot: () => rows,
      getHydrated: () => hydrated,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
    status: { getSnapshot: () => ({ hasEverSynced: true }) },
  } as unknown as SyncEngine;
  const store = new SecureStorageStore({
    getItem: () => Promise.resolve('3fc88d81-b940-4129-a060-8c92b90421b2'),
    setItem: () => Promise.resolve(),
    deleteItem: () => Promise.resolve(),
  });
  const view = render(() => (
    <I18nProvider i18n={i18n}>
      <ThemeProvider colorScheme="light">
        <SecureStorageStoreProvider value={store}>
          <SyncEngineProvider value={engine}>
            <SpacesLobbyContent class="box">
              <div>Spaces</div>
            </SpacesLobbyContent>
          </SyncEngineProvider>
        </SecureStorageStoreProvider>
      </ThemeProvider>
    </I18nProvider>
  ));
  return {
    dispose: () => view.unmount(),
    answer: (count: number) => {
      rows = [{ hosted: count }];
      hydrated = true;
      for (const listener of listeners) listener();
    },
  };
}

// regression: journey-hosting-count-hydration-race
test('the lobby answers only after its hosted-space count has hydrated', () => {
  const lobby = mountLobby();
  expect(screen.queryByTestId(Handles.spacesListReady)).toBeNull();
  lobby.answer(1);
  expect(screen.getByTestId(Handles.spacesListReady)).toBeVisible();
  expect(screen.getByTestId(Handles.spacesHostingCount)).toHaveTextContent(
    'Hosting 1 space'
  );
  lobby.answer(0);
  expect(screen.getByTestId(Handles.spacesListReady)).toBeVisible();
  expect(screen.queryByTestId(Handles.spacesHostingCount)).toBeNull();
});

test('an answered lobby reflects every hosting count, including zero', () => {
  assertProperty(
    'hydration distinguishes unknown hosting from an answered count',
    fc.property(fc.nat(100), (count) => {
      const lobby = mountLobby();
      try {
        expect(screen.queryByTestId(Handles.spacesListReady)).toBeNull();
        lobby.answer(count);
        expect(screen.getByTestId(Handles.spacesListReady)).toBeVisible();
        const hosting = screen.queryByTestId(Handles.spacesHostingCount);
        expect(hosting?.getAttribute('data-count') ?? null).toBe(
          count > 0 ? String(count) : null
        );
      } finally {
        lobby.dispose();
      }
    })
  );
});
