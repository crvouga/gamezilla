/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';
// regression: sync-engine-self-export-skips-tsx
// This literal public self-import must resolve from the package's own test process.
import {
  createQuery,
  SyncEnginePaintGateProvider,
  SyncEngineProvider,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type {
  SyncEngine,
  WatchSubscription,
} from '@pkgs/sync-engine-client-ts/sync-engine-port';
import { render, screen } from '@solidjs/testing-library';
import { createSignal, For } from 'solid-js';

type Row = { id: string };

type FakeWatch = WatchSubscription<readonly Row[]> & {
  emit: (rows: readonly Row[]) => void;
  listenerCount: () => number;
};

function createFakeWatch(): FakeWatch {
  let snapshot: readonly Row[] = [];
  let hydrated = false;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    getHydrated: () => hydrated,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: (rows) => {
      snapshot = rows;
      hydrated = true;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}

function createFakeEngine() {
  const watches = new Map<string, FakeWatch>();
  let online = true;
  const statusListeners = new Set<() => void>();
  const status = () => ({
    connection: 'connected' as const,
    online,
    hasSynced: true,
    hasEverSynced: true,
    lastSyncedAtMs: null,
    lastError: null,
  });
  const engine = {
    watch<T extends Record<string, unknown>>(query: Sql<T>) {
      const key = `${query.sql}|${JSON.stringify(query.values)}`;
      let watch = watches.get(key);
      if (watch === undefined) {
        watch = createFakeWatch();
        watches.set(key, watch);
      }
      return watch as unknown as WatchSubscription<readonly T[]>;
    },
    status: {
      getSnapshot: status,
      subscribe: (listener: () => void) => {
        statusListeners.add(listener);
        return () => statusListeners.delete(listener);
      },
    },
  } as unknown as SyncEngine;
  return {
    engine,
    watches,
    setOnline(next: boolean) {
      online = next;
      for (const listener of statusListeners) listener();
    },
  };
}

function Rows(props: { readonly owner: () => string }) {
  const result = createQuery(
    () => sql<Row>`SELECT id FROM notes WHERE owner_id = ${props.owner()}`
  );
  return (
    <div>
      <p data-testid="loading">{result.isLoading() ? 'loading' : 'ready'}</p>
      <ul>
        <For each={result.rows()}>{(row) => <li>{row.id}</li>}</For>
      </ul>
    </div>
  );
}

function Status() {
  const api = useSyncEngine();
  return (
    <p data-testid="status">
      {api.status().online ? 'online' : 'offline'}/
      {api.paintReady() ? 'paint' : 'hold'}
    </p>
  );
}

describe('@pkgs/sync-engine/solid', () => {
  test('createQuery tracks the watch, re-subscribes when params change', () => {
    const fake = createFakeEngine();
    const [owner, setOwner] = createSignal('alice');
    render(() => (
      <SyncEngineProvider value={fake.engine}>
        <Rows owner={owner} />
      </SyncEngineProvider>
    ));

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(fake.watches.size).toBe(1);
    const [aliceWatch] = [...fake.watches.values()];
    if (aliceWatch === undefined) throw new Error('expected a watch');
    expect(aliceWatch.listenerCount()).toBe(1);

    aliceWatch.emit([{ id: 'n1' }, { id: 'n2' }]);
    expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      ['n1', 'n2']
    );

    setOwner('bob');
    expect(fake.watches.size).toBe(2);
    expect(aliceWatch.listenerCount()).toBe(0);
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  test('useSyncEngine exposes reactive status and paint gate', () => {
    const fake = createFakeEngine();
    const [ready, setReady] = createSignal(false);
    render(() => (
      <SyncEngineProvider value={fake.engine}>
        <SyncEnginePaintGateProvider ready={ready}>
          <Status />
        </SyncEnginePaintGateProvider>
      </SyncEngineProvider>
    ));
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('online/hold');
    fake.setOnline(false);
    setReady(true);
    expect(status).toHaveTextContent('offline/paint');
  });

  test('hooks fail loudly outside the provider', () => {
    expect(() => render(() => <Status />)).toThrow(
      'useSyncEngine: provider missing'
    );
  });
});
