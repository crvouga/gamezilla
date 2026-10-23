import { expect, test } from 'bun:test';
import { createLocalSyncStatusStore } from '@pkgs/sync-engine-client-ts/local-sync-status';
import { INITIAL_SYNC_STATUS } from '@pkgs/sync-engine-client-ts/sync-status';

// regression: sync-status-noop-patch-repaints
test('repeating online=true preserves the initial snapshot without notifying', () => {
  const store = createLocalSyncStatusStore();
  const initial = store.status.getSnapshot();
  let notifications = 0;
  const unsubscribe = store.status.subscribe(() => notifications++);
  store.patch({ online: true });
  store.patch({ online: true });
  expect(store.status.getSnapshot()).toBe(initial);
  expect(notifications).toBe(0);
  store.patch({ online: false });
  expect(store.status.getSnapshot().online).toBe(false);
  expect(notifications).toBe(1);
  unsubscribe();
});

test('the first-sync latch, errors and identity reset still publish actual changes', () => {
  const store = createLocalSyncStatusStore();
  const states: unknown[] = [];
  store.status.subscribe((state) => states.push(state));
  store.patch({ hasSynced: true });
  expect(store.status.getSnapshot().hasEverSynced).toBe(true);
  store.patch({ hasEverSynced: false });
  expect(states).toHaveLength(1);
  store.patch({
    hasSynced: false,
    lastError: 'unavailable',
    lastSyncedAtMs: 42,
  });
  expect(store.status.getSnapshot()).toMatchObject({
    hasEverSynced: true,
    hasSynced: false,
    lastError: 'unavailable',
    lastSyncedAtMs: 42,
  });
  expect(states).toHaveLength(2);
  store.reset();
  expect(store.status.getSnapshot()).toEqual(INITIAL_SYNC_STATUS);
  expect(states).toHaveLength(3);
  store.reset();
  expect(states).toHaveLength(3);
});
