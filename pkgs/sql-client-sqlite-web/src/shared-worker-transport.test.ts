import { afterEach, describe, expect, test } from 'bun:test';
import type { Timers } from '@pkgs/clock';
import { createBrokerCore } from './broker-core';
import type { OwnerRuntime } from './owner-runtime';
import type { ConnectResult } from './rpc';
import { createSharedWorkerTransport } from './shared-worker-transport';
import { releaseOnPageHide } from './web-sql-client';

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

function stubOwnerRuntime(dbName: string): OwnerRuntime {
  return {
    dbName,
    open: async () => undefined,
    close: async () => undefined,
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
  const transport = createSharedWorkerTransport({
    dbName: 'app',
    timers: parkedTimers,
    workerUrl: '/db-host-shared-worker.js',
    createOwnerRuntimeFn: ({ dbName }) => stubOwnerRuntime(dbName),
  });
  let onPageHide: ((event: { persisted: boolean }) => void) | null = null;
  releaseOnPageHide(
    {
      addEventListener: (_type, listener) => {
        onPageHide = listener;
      },
    },
    // A discarded page never gets to run its async disconnect.
    { disconnect: () => new Promise<void>(() => undefined) },
    transport
  );
  return {
    connect: (): Promise<ConnectResult> => transport.connect(),
    pageHide: (persisted: boolean) => onPageHide?.({ persisted }),
  };
}

describe('shared-worker transport across page loads', () => {
  afterEach(() => {
    delete (globalThis as { SharedWorker?: unknown }).SharedWorker;
  });

  // regression: sqlite-web-navigation-dead-owner — a same-tab navigation
  // (the sign-in callback, any reload) left the discarded page as the
  // broker's owner, so the next page proxied to it and boot hung ~20s
  // until the heartbeat reaper evicted it.
  test('the next page in the tab owns the database at once', async () => {
    installSharedWorker();
    const first = openPage();
    expect((await first.connect()).role).toBe('owner');

    first.pageHide(false);
    const next = openPage();

    expect((await next.connect()).role).toBe('owner');
  });

  test('a page kept in the back/forward cache keeps its ownership', async () => {
    installSharedWorker();
    const first = openPage();
    expect((await first.connect()).role).toBe('owner');

    first.pageHide(true);
    const other = openPage();

    expect((await other.connect()).role).toBe('proxy');
  });
});
