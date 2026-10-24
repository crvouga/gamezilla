import { afterEach, describe, expect, test } from 'bun:test';
import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { OwnerRuntime } from '@pkgs/sql-client-sqlite-web-client-ts/owner-runtime';
import { createSharedWorkerTransport } from '@pkgs/sql-client-sqlite-web-client-ts/shared-worker-transport';
import { releaseOnPageHide } from '@pkgs/sql-client-sqlite-web-client-ts/web-sql-client';
import { createBrokerCore } from '@pkgs/sql-client-sqlite-web-shared-ts/broker-core';
import type {
  ConnectResult,
  DbChangedNotify,
} from '@pkgs/sql-client-sqlite-web-shared-ts/rpc';

/** Timers that never fire: heartbeats and RPC timeouts stay parked. */
const parkedTimers: Timers = {
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
} as unknown as Timers;

/**
 * One SharedWorker broker shared by every "page". Messages hop a microtask,
 * like a real MessagePort; a discarded page's port never fires `close`
 * (WebKit has no MessagePort close event).
 */
function installSharedWorker(): void {
  const broker = createBrokerCore({
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    now: () => 0,
  });
  let nextPortId = 0;
  class FakeSharedWorker {
    onerror: unknown = null;
    readonly port: {
      onmessage: ((event: { data: unknown }) => void) | null;
      start: () => void;
      close: () => void;
      postMessage: (message: unknown) => void;
    };
    constructor() {
      const id = `port_${++nextPortId}`;
      const port: FakeSharedWorker['port'] = {
        onmessage: null,
        start: () => undefined,
        close: () => undefined,
        postMessage: (message) => {
          queueMicrotask(() => broker.handleMessage(id, message));
        },
      };
      broker.attachPort({
        id,
        postMessage: (message) => {
          queueMicrotask(() => port.onmessage?.({ data: message }));
        },
      });
      this.port = port;
    }
  }
  (globalThis as { SharedWorker?: unknown }).SharedWorker = FakeSharedWorker;
}

function stubOwnerRuntime(dbName: string, onRelease: () => void): OwnerRuntime {
  return {
    dbName,
    open: async () => undefined,
    close: async () => undefined,
    release: onRelease,
    getClient: () => {
      throw new Error('not used');
    },
    handleRequest: async (request) => ({
      id: request.id,
      ok: true,
      result: null,
    }),
    onChanged: () => () => undefined,
    resetDatabase: async () => undefined,
    hasActiveTx: () => false,
  };
}

function openPage() {
  let storeReleased = false;
  const transport = createSharedWorkerTransport({
    dbName: 'app',
    timers: parkedTimers,
    workerUrl: '/db-host-shared-worker.js',
    createOwnerRuntimeFn: ({ dbName }) =>
      stubOwnerRuntime(dbName, () => {
        storeReleased = true;
      }),
  });
  const listeners = new Map<string, (event: { persisted: boolean }) => void>();
  let reloads = 0;
  releaseOnPageHide(
    {
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
      },
    },
    // A discarded or frozen page never finishes its async disconnect.
    { disconnect: () => new Promise<void>(() => undefined) },
    transport,
    () => {
      reloads += 1;
    }
  );
  return {
    connect: (): Promise<ConnectResult> => transport.connect(),
    pageHide: () => listeners.get('pagehide')?.({ persisted: true }),
    pageShow: (persisted: boolean) =>
      listeners.get('pageshow')?.({ persisted }),
    storeReleased: () => storeReleased,
    reloads: () => reloads,
  };
}

describe('shared-worker transport across page loads', () => {
  afterEach(() => {
    delete (globalThis as { SharedWorker?: unknown }).SharedWorker;
  });

  // regression: sqlite-released-page-starts-new-owner
  test('a released page cannot reconnect or issue another database request', async () => {
    installSharedWorker();
    let created = 0;
    const page = createSharedWorkerTransport({
      dbName: 'app',
      timers: parkedTimers,
      workerUrl: '/db-host-shared-worker.js',
      createOwnerRuntimeFn: ({ dbName }) => {
        created++;
        return stubOwnerRuntime(dbName, () => undefined);
      },
    });
    await page.connect();
    page.leaveOnUnload();
    await expect(page.connect()).rejects.toThrow('SQLite page released');
    await expect(
      page.request('query', { sql: 'SELECT 1', values: [] })
    ).rejects.toThrow('SQLite page released');
    expect(created).toBe(1);
  });

  test('an ordinary disconnect still permits an explicit reconnect', async () => {
    installSharedWorker();
    const page = createSharedWorkerTransport({
      dbName: 'app',
      timers: parkedTimers,
      workerUrl: '/db-host-shared-worker.js',
      createOwnerRuntimeFn: ({ dbName }) =>
        stubOwnerRuntime(dbName, () => undefined),
    });
    await page.connect();
    await page.disconnect();
    expect((await page.connect()).role).toBe('owner');
    page.leaveOnUnload();
  });

  // regression: sqlite-proxy-request-arrives-after-promotion
  test('a request sent as a proxy completes after that page becomes the owner', async () => {
    installSharedWorker();
    const page = () =>
      createSharedWorkerTransport({
        dbName: 'app',
        timers: parkedTimers,
        workerUrl: '/db-host-shared-worker.js',
        createOwnerRuntimeFn: ({ dbName }) => ({
          ...stubOwnerRuntime(dbName, () => undefined),
          handleRequest: async (request) => ({
            id: request.id,
            ok: true,
            result: [{ kept: 1 }],
          }),
        }),
      });
    const first = page();
    const next = page();
    try {
      expect((await first.connect()).role).toBe('owner');
      expect((await next.connect()).role).toBe('proxy');
      // Disconnect and the queued query reach the broker before its promotion
      // message reaches the new owner page.
      first.leaveOnUnload();
      expect(
        await next.request('query', { sql: 'SELECT 1 AS kept', values: [] })
      ).toEqual([{ kept: 1 }]);
    } finally {
      next.leaveOnUnload();
      first.leaveOnUnload();
    }
  });

  // regression: sqlite-promoted-owner-drops-requests-during-open
  test('requests during owner promotion wait for the opening database', async () => {
    installSharedWorker();
    const opening = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    const page = (promoted = false) =>
      createSharedWorkerTransport({
        dbName: 'app',
        timers: parkedTimers,
        workerUrl: '/db-host-shared-worker.js',
        createOwnerRuntimeFn: ({ dbName }) => {
          let changed: (notify: DbChangedNotify) => void = () => undefined;
          return {
            ...stubOwnerRuntime(dbName, () => undefined),
            open: async () => {
              if (!promoted) return;
              entered.resolve();
              await opening.promise;
            },
            handleRequest: async (request) => {
              if (promoted) await opening.promise;
              changed({ type: 'db-changed', dbName });
              return { id: request.id, ok: true, result: [{ kept: 1 }] };
            },
            onChanged: (listener) => {
              changed = listener;
              return () => undefined;
            },
          };
        },
      });
    const first = page();
    const next = page(true);
    const reader = page();
    const errors: unknown[] = [];
    const notifications: string[] = [];
    reader.onChanged((notify) => notifications.push(notify.dbName));
    let result: unknown = 'unanswered';
    try {
      expect((await first.connect()).role).toBe('owner');
      expect((await next.connect()).role).toBe('proxy');
      expect((await reader.connect()).role).toBe('proxy');
      first.leaveOnUnload();
      await entered.promise;
      void reader
        .request('query', { sql: 'SELECT 1 AS kept', values: [] })
        .then(
          (value) => {
            result = value;
          },
          (error) => {
            errors.push(error);
          }
        );
      for (let turn = 0; turn < 50; turn++) await Promise.resolve();
      expect(result).toBe('unanswered');
      opening.resolve();
      for (let turn = 0; turn < 50; turn++) await Promise.resolve();
      expect(errors).toEqual([]);
      expect(result).toEqual([{ kept: 1 }]);
      expect(notifications).toEqual(['app']);
    } finally {
      opening.resolve();
      reader.leaveOnUnload();
      next.leaveOnUnload();
      first.leaveOnUnload();
    }
  });

  test('leaving while the database opens releases the pending owner', async () => {
    // regression: sqlite-web-navigation-during-open
    installSharedWorker();
    const opening = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    let released = false;
    const first = createSharedWorkerTransport({
      dbName: 'app',
      timers: parkedTimers,
      workerUrl: '/db-host-shared-worker.js',
      createOwnerRuntimeFn: ({ dbName }) => ({
        ...stubOwnerRuntime(dbName, () => {
          released = true;
        }),
        open: () => {
          entered.resolve();
          return opening.promise;
        },
      }),
    });
    void first.connect();
    await entered.promise;
    first.leaveOnUnload();
    expect(released).toBe(true);
    expect((await openPage().connect()).role).toBe('owner');
  });

  // regression: sqlite-broker-connect-outlives-disconnect
  test('a broker response arriving after unload cannot start an owner', async () => {
    installSharedWorker();
    let created = 0;
    const first = createSharedWorkerTransport({
      dbName: 'app',
      timers: parkedTimers,
      workerUrl: '/db-host-shared-worker.js',
      createOwnerRuntimeFn: ({ dbName }) => {
        created += 1;
        return stubOwnerRuntime(dbName, () => undefined);
      },
    });
    const opening = first.connect().catch(() => undefined);
    first.leaveOnUnload();
    await opening;
    expect(created).toBe(0);
    expect(first.isOwner()).toBe(false);
    expect((await openPage().connect()).role).toBe('owner');
  });

  // regression: sqlite-web-navigation-dead-owner — a same-tab navigation
  // (the sign-in callback, any reload) left the previous page owning the
  // store: discarded, or frozen in the back/forward cache still holding its
  // OPFS handles. The next page waited on the dead owner and boot hung.
  test('the next page in the tab owns the database at once', async () => {
    installSharedWorker();
    const first = openPage();
    expect((await first.connect()).role).toBe('owner');

    first.pageHide();
    const next = openPage();

    expect((await next.connect()).role).toBe('owner');
    expect(first.storeReleased()).toBe(true);
  });

  test('a page restored from the back/forward cache reloads', () => {
    const page = openPage();

    page.pageShow(false);
    expect(page.reloads()).toBe(0);

    page.pageShow(true);
    expect(page.reloads()).toBe(1);
  });
});
