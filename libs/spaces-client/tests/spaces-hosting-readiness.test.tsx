import { expect, test } from 'bun:test';
import { SpacesLobby } from '@libs/spaces-client/spaces-lobby';
import { Handles } from '@libs/test-ids-shared/handles';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage-root-client/solid';
import { SecureStorageStore } from '@pkgs/secure-storage-root-shared/secure-storage-store';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import { SyncEngineProvider } from '@pkgs/sync-engine-client/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client/sync-engine-port';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { IdProvider } from '@pkgs/uuid-client/solid';
import { render, screen } from '@solidjs/testing-library';
import fc from 'fast-check';

/** Which of the lobby's local reads a watch is. */
type LobbyRead = 'hosted' | 'list' | 'other';

function lobbyRead(query: Sql<unknown>): LobbyRead {
  if (query.sql.includes('AS hosted')) return 'hosted';
  if (query.sql.includes('host_member_id')) return 'list';
  return 'other';
}

/** One answer per lobby read: each hydrates on its own. */
type ReadState = {
  rows: readonly Record<string, unknown>[];
  hydrated: boolean;
};

function mountLobby() {
  const reads: Record<LobbyRead, ReadState> = {
    hosted: { rows: [], hydrated: false },
    list: { rows: [], hydrated: false },
    other: { rows: [], hydrated: true },
  };
  const listeners = new Set<() => void>();
  const engine = {
    watch: (query: Sql<unknown>) => {
      const read = lobbyRead(query);
      return {
        getSnapshot: () => reads[read].rows,
        getHydrated: () => reads[read].hydrated,
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    },
    status: {
      getSnapshot: () => ({ hasEverSynced: true, online: true }),
      subscribe: () => () => undefined,
    },
  } as unknown as SyncEngine;
  const store = new SecureStorageStore({
    getItem: () => Promise.resolve('3fc88d81-b940-4129-a060-8c92b90421b2'),
    setItem: () => Promise.resolve(),
    deleteItem: () => Promise.resolve(),
  });
  const view = render(() => (
    <I18nProvider i18n={i18n}>
      <ThemeProvider colorScheme="light">
        <IdProvider
          createId={() => '22222222-2222-4222-8222-222222222222'}
          random={() => 0.5}
        >
          <SecureStorageStoreProvider value={store}>
            <SyncEngineProvider value={engine}>
              <SpacesLobby onCreateSpace={() => undefined} />
            </SyncEngineProvider>
          </SecureStorageStoreProvider>
        </IdProvider>
      </ThemeProvider>
    </I18nProvider>
  ));
  const answer = (
    read: LobbyRead,
    rows: readonly Record<string, unknown>[]
  ): void => {
    reads[read] = { rows, hydrated: true };
    for (const listener of listeners) listener();
  };
  return {
    dispose: () => view.unmount(),
    answerHosted: (count: number) => answer('hosted', [{ hosted: count }]),
    answerListEmpty: () => answer('list', []),
  };
}

/** Lets the stored identity resolve, as it does before a lobby paints. */
async function identityResolved(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

function emptyLobbyShown(): boolean {
  return screen.queryByText('No spaces yet') !== null;
}

// regression: journey-hosting-count-hydration-race
test('the lobby answers only after its hosted-space count has hydrated', async () => {
  const lobby = mountLobby();
  await identityResolved();
  lobby.answerListEmpty();
  expect(screen.queryByTestId(Handles.spacesListReady)).toBeNull();
  lobby.answerHosted(1);
  expect(screen.getByTestId(Handles.spacesListReady)).toBeVisible();
  expect(screen.getByTestId(Handles.spacesHostingCount)).toHaveTextContent(
    'Hosting 1 space'
  );
  lobby.answerHosted(0);
  expect(screen.getByTestId(Handles.spacesListReady)).toBeVisible();
  expect(screen.queryByTestId(Handles.spacesHostingCount)).toBeNull();
  lobby.dispose();
});

// regression: lobby-empty-while-loading
test('the lobby never says there are no spaces before its list has answered', async () => {
  const lobby = mountLobby();
  await identityResolved();
  lobby.answerHosted(0);
  expect(emptyLobbyShown()).toBe(false);
  expect(screen.queryByTestId(Handles.spacesListReady)).toBeNull();
  lobby.answerListEmpty();
  expect(screen.getByTestId(Handles.spacesListReady)).toBeVisible();
  expect(emptyLobbyShown()).toBe(true);
  lobby.dispose();
});

test('an answered lobby reflects every hosting count, including zero', async () => {
  await assertProperty(
    'hydration distinguishes unknown hosting from an answered count',
    fc.asyncProperty(fc.nat(100), async (count) => {
      const lobby = mountLobby();
      try {
        await identityResolved();
        lobby.answerListEmpty();
        expect(screen.queryByTestId(Handles.spacesListReady)).toBeNull();
        lobby.answerHosted(count);
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
