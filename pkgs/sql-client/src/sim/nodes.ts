import { knob, node } from '@pkgs/determinism';
import fc from 'fast-check';
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

export const SQL_TAB_COUNT = knob(2, fc.integer({ min: 1, max: 3 }));
export const SQL_POOL_CAPACITY = knob(6, fc.constantFrom(2, 6));
export const SQL_SCHEMA_EPOCH = knob(1, fc.constant(1));
export const SQL_BACKEND = knob(
  'web-sim-opfs' as SqlClientWebBackend,
  fc.constantFrom('web-sim-opfs', 'sqlite-mem')
);

export type SqlWebStoreHandle = {
  readonly store: SimOpfsStore;
  readonly broker: BrokerCore;
  readonly board: SqlClientWebState;
};

export type SqlWebTabHandle = {
  readonly id: string;
  readonly runtime: OwnerRuntime;
};

/**
 * Shared durable store (simulated AccessHandlePoolVFS) plus the in-process
 * broker every tab elects its owner through. Boots before any tab.
 */
export const sqlWebStoreNode = node({
  start: (ctx) => {
    const board = createSqlClientWebState();
    const store = createSimOpfsStore({
      capacity: Number(ctx.knob(SQL_POOL_CAPACITY)),
    });
    const broker = createBrokerCore({
      setTimeout: (fn, ms) => ctx.ports.timers.setTimeout(fn, ms),
      clearTimeout: (id) => ctx.ports.timers.clearTimeout(id),
      now: () => ctx.ports.clock.now(),
    });
    board.backend = ctx.knob(SQL_BACKEND);
    board.epoch = Number(ctx.knob(SQL_SCHEMA_EPOCH));
    board.store = store;
    board.broker = broker;
    return { store, broker, board };
  },
});

/**
 * One browser tab. It only opens its owner runtime while the broker elects it.
 */
export const sqlWebTabNode = node({
  start: (ctx) => {
    const storeHandle = ctx.peers.single('store') as SqlWebStoreHandle;
    const board = storeHandle.board;
    const runtime = createOwnerRuntime({
      dbName: SIM_DB_NAME,
      timers: ctx.ports.timers,
      createOwner: () => createTabOwner(board),
      migrate: (client) => migrateToyKv(client, board),
      notifyPeersOnRecover: false,
    });
    board.tabs.set(ctx.id, { id: ctx.id, runtime, open: false });
    requireBroker(board).attachPort(tabPort(ctx.id));
    return { id: ctx.id, runtime };
  },
  stop: async (handle) => {
    await handle.runtime.close();
  },
});
