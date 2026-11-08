import { afterEach, expect, test } from 'bun:test';
import { useFriendUserProfile } from '@libs/friends-client-ts/use-friend-user-profile';
import type { ProfileRow } from '@libs/profile-shared-ts/profile-row-sql';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage-root-client-ts/solid';
import { SecureStorageStore } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';
import { SyncEngineProvider } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import {
  INITIAL_SYNC_STATUS,
  type SyncEngineStatus,
} from '@pkgs/sync-engine-client-ts/sync-status';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { cleanup, render, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

function profileProbe(initialStatus: Partial<SyncEngineStatus> = {}) {
  let status: SyncEngineStatus = {
    ...INITIAL_SYNC_STATUS,
    hasEverSynced: true,
    ...initialStatus,
  };
  const listeners = new Set<(value: SyncEngineStatus) => void>();
  const subscriptions: { resolve: () => void; closed: boolean }[] = [];
  let refreshes = 0;
  let rows: readonly (ProfileRow & { deleted_at?: string | null })[] = [];
  const rowListeners = new Set<() => void>();
  const engine = {
    watch: () => ({
      getSnapshot: () => rows,
      getHydrated: () => true,
      subscribe: (listener: () => void) => {
        rowListeners.add(listener);
        return () => {
          rowListeners.delete(listener);
        };
      },
    }),
    status: {
      getSnapshot: () => status,
      subscribe: (listener: (value: SyncEngineStatus) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    refreshQueries: async () => {
      refreshes += 1;
    },
    subscribeQuery: () => {
      const pending = Promise.withResolvers<void>();
      const item = { resolve: () => pending.resolve(), closed: false };
      subscriptions.push(item);
      return {
        waitForFirstSync: () => pending.promise,
        unsubscribe: () => {
          item.closed = true;
        },
      };
    },
  } as unknown as SyncEngine;
  const storage = new SecureStorageStore({
    getItem: async () => null,
    setItem: async () => undefined,
    deleteItem: async () => undefined,
  });
  const [id, setId] = createSignal('alice');
  let state: ReturnType<typeof useFriendUserProfile> | undefined;
  function Probe() {
    state = useFriendUserProfile(id);
    return null;
  }
  const view = render(() => (
    <SecureStorageStoreProvider value={storage}>
      <SyncEngineProvider value={engine}>
        <StaticAppRouterProvider
          router={{
            push: () => undefined,
            replace: () => undefined,
            back: () => undefined,
            canGoBack: () => false,
          }}
        >
          <Probe />
        </StaticAppRouterProvider>
      </SyncEngineProvider>
    </SecureStorageStoreProvider>
  ));
  if (state === undefined) throw new Error('Profile probe did not mount');
  return {
    state,
    setId,
    subscriptions,
    unmount: view.unmount,
    refreshes: () => refreshes,
    setRows: (
      next: readonly (ProfileRow & { deleted_at?: string | null })[]
    ) => {
      rows = next;
      for (const listener of rowListeners) listener();
    },
    setStatus: (next: Partial<SyncEngineStatus>) => {
      status = { ...status, ...next };
      for (const listener of listeners) listener(status);
    },
  };
}

test('an empty local profile waits for its own first sync before becoming unavailable', async () => {
  // regression: friend-profile-empty-before-sync
  const probe = profileProbe();
  expect(probe.state.loading()).toBe(true);
  expect(probe.state.unavailable()).toBe(false);
  expect(probe.state.unreachable()).toBe(false);
  probe.subscriptions[0]?.resolve();
  await waitFor(() => expect(probe.state.unavailable()).toBe(true));
  expect(probe.state.loading()).toBe(false);
});

for (const failure of [
  { online: false },
  { lastError: 'server unavailable' },
] as const) {
  test(`an unsynced profile offers recovery when ${JSON.stringify(failure)}`, () => {
    // regression: friend-profile-empty-before-sync
    const probe = profileProbe(failure);
    expect(probe.state.unreachable()).toBe(true);
    expect(probe.state.unavailable()).toBe(false);
    expect(probe.state.loading()).toBe(false);
    probe.state.refreshProfile();
    expect(probe.refreshes()).toBe(1);
    probe.setStatus({ online: true, lastError: null });
    expect(probe.state.unreachable()).toBe(false);
    expect(probe.state.loading()).toBe(true);
  });
}

test('a previous profile response cannot mark the next profile unavailable', async () => {
  // regression: friend-profile-empty-before-sync
  const probe = profileProbe();
  const alice = probe.subscriptions[0];
  probe.setId('bob');
  expect(alice?.closed).toBe(true);
  alice?.resolve();
  await Promise.resolve();
  expect(probe.state.profile().userId).toBe('bob');
  expect(probe.state.loading()).toBe(true);
  expect(probe.state.unavailable()).toBe(false);
  probe.subscriptions[1]?.resolve();
  await waitFor(() => expect(probe.state.unavailable()).toBe(true));
  probe.unmount();
  expect(probe.subscriptions.every((item) => item.closed)).toBe(true);
});

test('a profile returned by the first response becomes available and survives disconnection', async () => {
  // regression: friend-profile-empty-before-sync
  const probe = profileProbe();
  expect(probe.state.loading()).toBe(true);
  probe.setRows([
    {
      id: 'alice',
      username: 'alice_plays',
      avatar_config: 'avatar-alice',
      created_at: null,
      username_changed_at: null,
      account_kind: null,
    },
  ]);
  probe.subscriptions[0]?.resolve();
  await waitFor(() =>
    expect(probe.state.profile().username).toBe('alice_plays')
  );
  expect(probe.state.profile().avatarConfig).toBe('avatar-alice');
  expect(probe.state.loading()).toBe(false);
  expect(probe.state.unavailable()).toBe(false);
  probe.setStatus({ online: false, lastError: 'Connection unavailable' });
  expect(probe.state.unreachable()).toBe(false);
  expect(probe.state.profile().username).toBe('alice_plays');
});

// regression: friend-deleted-profile-explanation-lost
test('a synced tombstone identifies deletion without exposing the old identity', async () => {
  const probe = profileProbe();
  probe.setRows([
    {
      id: 'alice',
      username: 'former_name',
      avatar_config: 'former_avatar',
      created_at: null,
      username_changed_at: null,
      account_kind: null,
      deleted_at: '2026-11-07T00:00:00.000Z',
    },
  ]);
  expect(probe.state.deleted()).toBe(false);
  expect(probe.state.loading()).toBe(true);
  probe.subscriptions[0]?.resolve();
  await waitFor(() => expect(probe.state.deleted()).toBe(true));
  expect(probe.state.profile()).toEqual({
    userId: 'alice',
    username: '',
    avatarConfig: null,
  });
  probe.setRows([]);
  expect(probe.state.deleted()).toBe(false);
  expect(probe.state.unavailable()).toBe(true);
});
