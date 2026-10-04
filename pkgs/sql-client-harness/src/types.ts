import type { Session } from '@pkgs/harness-shared/runtime-types';
import type { BrokerCore } from '@pkgs/sql-client-sqlite-web-shared/broker-core';
import type { HarnessOpfsStore } from '@pkgs/sql-client-sqlite-web-shared/harness-opfs-sql-owner';
import type { OwnerRuntime } from '@pkgs/sql-client-sqlite-web-shared/owner-runtime';

/** Single logical database every simulated tab competes for. */
export const HARNESS_DB_NAME = 'kv';

export type SqlClientWebBackend = 'web-harness-opfs' | 'mockingbird-sqlite';

export type SqlWebTab = {
  readonly id: string;
  readonly runtime: OwnerRuntime;
  /** True while this tab holds a live SqlClient (broker-elected owner). */
  open: boolean;
};

/**
 * Harness board for the multi-tab web SQL system. `expected` is the harness
 * belief about durable `toy_kv` rows: writes add, wipes and schema-epoch drops
 * clear it, so invariants can compare it against the live owner connection.
 */
export type SqlClientWebState = {
  backend: SqlClientWebBackend;
  store: HarnessOpfsStore | null;
  broker: BrokerCore | null;
  epoch: number;
  appliedEpoch: number;
  wipes: number;
  rpcSeq: number;
  readonly tabs: Map<string, SqlWebTab>;
  readonly expected: Map<string, string>;
};

export type SqlClientWebSurface = {
  readonly session: Session;
  readonly board: SqlClientWebState;
  readonly tabIds: readonly string[];
};

export function createSqlClientWebState(): SqlClientWebState {
  return {
    backend: 'web-harness-opfs',
    store: null,
    broker: null,
    epoch: 1,
    appliedEpoch: 0,
    wipes: 0,
    rpcSeq: 0,
    tabs: new Map(),
    expected: new Map(),
  };
}

export function boardOf(surface: SqlClientWebSurface): SqlClientWebState {
  return surface.board;
}

export function requireStore(state: SqlClientWebState): HarnessOpfsStore {
  if (state.store === null) {
    throw new Error('sql-client.web harness: store node has not booted');
  }
  return state.store;
}

export function requireBroker(state: SqlClientWebState): BrokerCore {
  if (state.broker === null) {
    throw new Error('sql-client.web harness: broker has not booted');
  }
  return state.broker;
}

export function requireTab(state: SqlClientWebState, tabId: string): SqlWebTab {
  const tab = state.tabs.get(tabId);
  if (tab === undefined) {
    throw new Error(`sql-client.web harness: unknown tab ${tabId}`);
  }
  return tab;
}

export function nextRpcId(state: SqlClientWebState, prefix: string): string {
  state.rpcSeq += 1;
  return `${prefix}_${state.rpcSeq}`;
}

export function kvFingerprint(rows: ReadonlyMap<string, string>): string {
  const pairs = [...rows].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(pairs);
}
