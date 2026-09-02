import type { BrokerCore } from '../sqlite/web/broker-core';
import type { OwnerRuntime } from '../sqlite/web/owner-runtime';
import type { SimOpfsStore } from '../sqlite/web/owners/sim-opfs-sql-owner';

/** Single logical database every simulated tab competes for. */
export const SIM_DB_NAME = 'kv';

export type SqlClientWebBackend = 'web-sim-opfs' | 'sqlite-mem';

export type SqlWebTab = {
  readonly id: string;
  readonly runtime: OwnerRuntime;
  /** True while this tab holds a live SqlClient (broker-elected owner). */
  open: boolean;
};

/**
 * Harness board for the multi-tab web SQL world. `expected` is the harness
 * belief about durable `toy_kv` rows: writes add, wipes and schema-epoch drops
 * clear it, so invariants can compare it against the live owner connection.
 */
export type SqlClientWebState = {
  backend: SqlClientWebBackend;
  store: SimOpfsStore | null;
  broker: BrokerCore | null;
  epoch: number;
  appliedEpoch: number;
  wipes: number;
  rpcSeq: number;
  readonly tabs: Map<string, SqlWebTab>;
  readonly expected: Map<string, string>;
  readonly mismatches: string[];
};

export function createSqlClientWebState(): SqlClientWebState {
  return {
    backend: 'web-sim-opfs',
    store: null,
    broker: null,
    epoch: 1,
    appliedEpoch: 0,
    wipes: 0,
    rpcSeq: 0,
    tabs: new Map(),
    expected: new Map(),
    mismatches: [],
  };
}

export function boardOf(
  world: import('@pkgs/dst').World<
    Record<string, import('@pkgs/dst').KnobDef>,
    Record<string, import('@pkgs/dst').NodeEntry>,
    unknown
  >
): SqlClientWebState {
  return (world.nodes['store'] as { board: SqlClientWebState }).board;
}

export function requireStore(state: SqlClientWebState): SimOpfsStore {
  if (state.store === null) {
    throw new Error('sql-client.web sim: store node has not booted');
  }
  return state.store;
}

export function requireBroker(state: SqlClientWebState): BrokerCore {
  if (state.broker === null) {
    throw new Error('sql-client.web sim: broker has not booted');
  }
  return state.broker;
}

export function requireTab(state: SqlClientWebState, tabId: string): SqlWebTab {
  const tab = state.tabs.get(tabId);
  if (tab === undefined) {
    throw new Error(`sql-client.web sim: unknown tab ${tabId}`);
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
