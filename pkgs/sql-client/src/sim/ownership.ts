import type { SqlClient } from '../interface';
import type { BrokerPort } from '../sqlite/web/broker-core';
import { persistImage } from './owners';
import {
  nextRpcId,
  requireBroker,
  requireTab,
  SIM_DB_NAME,
  type SqlClientWebState,
} from './types';

/** Ownership is read back off the broker slot, so ports only need an id. */
export function tabPort(tabId: string): BrokerPort {
  return { id: tabId, postMessage: () => undefined };
}

/** `BrokerCore` resolves `connect` through an internal promise chain. */
function flushBroker(): Promise<void> {
  return Promise.resolve()
    .then(() => undefined)
    .then(() => undefined)
    .then(() => undefined);
}

export function ownerTabId(state: SqlClientWebState): string | null {
  return requireBroker(state).getSlot(SIM_DB_NAME)?.ownerPortId ?? null;
}

export function isTabConnected(
  state: SqlClientWebState,
  tabId: string
): boolean {
  const slot = requireBroker(state).getSlot(SIM_DB_NAME);
  return slot?.portIds.has(tabId) ?? false;
}

async function closeTabRuntime(
  state: SqlClientWebState,
  tabId: string
): Promise<void> {
  const tab = requireTab(state, tabId);
  if (!tab.open) return;
  tab.open = false;
  await tab.runtime.close();
}

export async function closeAllRuntimes(
  state: SqlClientWebState
): Promise<void> {
  for (const tab of state.tabs.values()) {
    await closeTabRuntime(state, tab.id);
  }
}

/**
 * Converge the world onto the broker's election: exactly one tab holds a live
 * `SqlClient`, everyone else is a proxy — same rule the SharedWorker enforces.
 */
export async function ensureOwnerClient(
  state: SqlClientWebState
): Promise<SqlClient | null> {
  const elected = ownerTabId(state);
  for (const tab of state.tabs.values()) {
    if (tab.id === elected) continue;
    await closeTabRuntime(state, tab.id);
  }
  if (elected === null) return null;
  const tab = requireTab(state, elected);
  if (!tab.open) {
    await tab.runtime.open();
    tab.open = true;
    persistImage(state, tab.runtime.getClient());
  }
  return tab.runtime.getClient();
}

export async function connectTab(
  state: SqlClientWebState,
  tabId: string
): Promise<SqlClient | null> {
  requireTab(state, tabId);
  if (!isTabConnected(state, tabId)) {
    requireBroker(state).handleMessage(tabId, {
      id: nextRpcId(state, 'connect'),
      dbName: SIM_DB_NAME,
      op: 'connect',
      payload: {},
    });
    await flushBroker();
  }
  return ensureOwnerClient(state);
}

export async function disconnectTab(
  state: SqlClientWebState,
  tabId: string
): Promise<void> {
  requireTab(state, tabId);
  requireBroker(state).handleMessage(tabId, {
    id: nextRpcId(state, 'disconnect'),
    dbName: SIM_DB_NAME,
    op: 'disconnect',
    payload: {},
  });
  await closeTabRuntime(state, tabId);
  await ensureOwnerClient(state);
}

/** Abrupt tab death, then reload: the port vanishes with no handshake. */
export async function killTab(
  state: SqlClientWebState,
  tabId: string
): Promise<void> {
  const broker = requireBroker(state);
  broker.detachPort(tabId);
  await closeTabRuntime(state, tabId);
  broker.attachPort(tabPort(tabId));
  await ensureOwnerClient(state);
}
