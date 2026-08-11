// @io-wall-ok — Playwright harness page entry
import { createHarnessClient, type HarnessClient } from './harness-client';

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
    };
  }
}

const clients = new Map<string, HarnessClient>();
let changed = 0;
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
};
