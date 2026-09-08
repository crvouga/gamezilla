// @io-wall-ok — Bun WebView e2e harness page entry
import { createHarnessClient, type HarnessClient } from './harness-client';

const OPFS_WIPE_CHANNEL = 'gamezilla-opfs-wipe';

declare global {
  interface Window {
    __sqlHarness: {
      connect: (dbName: string) => Promise<{ role: string }>;
      disconnect: () => Promise<void>;
      run: (
        dbName: string,
        statement: string,
        values?: unknown[]
      ) => Promise<unknown>;
      query: (
        dbName: string,
        statement: string,
        values?: unknown[]
      ) => Promise<unknown>;
      beginAbandonedTx: (dbName: string) => Promise<string>;
      isOwner: () => boolean;
      changedCount: () => number;
      forceLeader: boolean;
      /** Broadcast prepare-wipe; resolve with wipe-ready ack count. */
      prepareWipe: () => Promise<number>;
      /** How many times this tab acked wipe-ready after disconnect. */
      wipeReadySent: () => number;
      /** How many wipe-done messages this tab observed (no reload in harness). */
      wipeDoneCount: () => number;
      postWipeDone: () => void;
    };
  }
}

const clients = new Map<string, HarnessClient>();
let changed = 0;
let wipeReadySent = 0;
let wipeDoneCount = 0;
const params = new URLSearchParams(location.search);
const forceLeader = params.get('leader') === '1';

function getClient(dbName: string): HarnessClient {
  let client = clients.get(dbName);
  if (client === undefined) {
    client = createHarnessClient({ dbName, forceLeader });
    client.onChanged(() => {
      changed += 1;
    });
    clients.set(dbName, client);
  }
  return client;
}

// Mirror production attachLifecycle wipe protocol (without navigating away).
if (typeof BroadcastChannel !== 'undefined') {
  const wipeChannel = new BroadcastChannel(OPFS_WIPE_CHANNEL);
  wipeChannel.onmessage = (event: MessageEvent) => {
    const data = event.data as {
      type?: string;
      requestId?: string;
    };
    if (data === null || typeof data !== 'object') return;
    if (data.type === 'prepare-wipe' && typeof data.requestId === 'string') {
      void (async () => {
        for (const client of clients.values()) {
          await client.disconnect();
        }
        clients.clear();
        wipeChannel.postMessage({
          type: 'wipe-ready',
          requestId: data.requestId,
        });
        wipeReadySent += 1;
      })();
      return;
    }
    if (data.type === 'wipe-done') {
      wipeDoneCount += 1;
    }
  };
}

window.__sqlHarness = {
  forceLeader,
  connect: async (dbName) => {
    const client = getClient(dbName);
    const result = await client.connect();
    return { role: result.role };
  },
  disconnect: async () => {
    for (const client of clients.values()) {
      await client.disconnect();
    }
    clients.clear();
  },
  run: async (dbName, statement, values = []) => {
    return getClient(dbName).run(statement, values as never);
  },
  query: async (dbName, statement, values = []) => {
    return getClient(dbName).query(statement, values as never);
  },
  beginAbandonedTx: async (dbName) => {
    await getClient(dbName).beginAbandonedTx();
    return 'open';
  },
  isOwner: () => {
    for (const client of clients.values()) {
      if (client.isOwner()) return true;
    }
    return false;
  },
  changedCount: () => changed,
  prepareWipe: () =>
    new Promise<number>((resolve) => {
      const requestId = `wipe_${Date.now().toString(36)}`;
      const channel = new BroadcastChannel(OPFS_WIPE_CHANNEL);
      let ready = 0;
      channel.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; requestId?: string };
        if (data?.type === 'wipe-ready' && data.requestId === requestId) {
          ready += 1;
        }
      };
      channel.postMessage({ type: 'prepare-wipe', requestId });
      setTimeout(() => {
        try {
          channel.close();
        } catch {
          // ignore
        }
        resolve(ready);
      }, 2000);
    }),
  wipeReadySent: () => wipeReadySent,
  wipeDoneCount: () => wipeDoneCount,
  postWipeDone: () => {
    const channel = new BroadcastChannel(OPFS_WIPE_CHANNEL);
    channel.postMessage({ type: 'wipe-done' });
    channel.close();
  },
};
