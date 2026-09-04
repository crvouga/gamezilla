import type { Session } from '@pkgs/sim';
import { type BrokerCore, createBrokerCore } from '../sqlite/web/broker-core';
import {
  createOwnerRuntime,
  type OwnerRuntime,
} from '../sqlite/web/owner-runtime';
import {
  createSimOpfsStore,
  type SimOpfsStore,
} from '../sqlite/web/owners/sim-opfs-sql-owner';
import { createTabOwner } from './owners';
import { tabPort } from './ownership';
import { migrateToyKv } from './toy-kv';
import {
  createSqlClientWebState,
  requireBroker,
  SIM_DB_NAME,
  type SqlClientWebBackend,
  type SqlClientWebState,
} from './types';

export type SqlWebStoreHandle = {
  readonly store: SimOpfsStore;
  readonly broker: BrokerCore;
  readonly board: SqlClientWebState;
};

export type SqlWebTabHandle = {
  readonly id: string;
  readonly runtime: OwnerRuntime;
};

export function startStore(
  session: Session,
  opts: {
    readonly poolCapacity: number;
    readonly schemaEpoch: number;
    readonly backend: SqlClientWebBackend;
  }
): SqlWebStoreHandle {
  const board = createSqlClientWebState();
  const store = createSimOpfsStore({ capacity: opts.poolCapacity });
  const broker = createBrokerCore({
    setTimeout: (fn, ms) => session.ports.timers.setTimeout(fn, ms),
    clearTimeout: (id) => session.ports.timers.clearTimeout(id),
    now: () => session.ports.clock.now(),
  });
  board.backend = opts.backend;
  board.epoch = opts.schemaEpoch;
  board.store = store;
  board.broker = broker;
  return { store, broker, board };
}

export function startTab(
  session: Session,
  board: SqlClientWebState,
  id: string
): SqlWebTabHandle {
  const runtime = createOwnerRuntime({
    dbName: SIM_DB_NAME,
    timers: session.ports.timers,
    createOwner: () => createTabOwner(board),
    migrate: (client) => migrateToyKv(client, board),
    notifyPeersOnRecover: false,
  });
  board.tabs.set(id, { id, runtime, open: false });
  requireBroker(board).attachPort(tabPort(id));
  return { id, runtime };
}
