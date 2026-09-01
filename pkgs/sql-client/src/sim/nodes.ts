import { defineNodeKind } from '@pkgs/determinism';
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
  requireBroker,
  SIM_DB_NAME,
  type SqlClientWebBackend,
  type SqlClientWebState,
} from './types';

export type SqlWebStoreHandle = {
  readonly store: SimOpfsStore;
  readonly broker: BrokerCore;
};

export type SqlWebTabHandle = {
  readonly id: string;
  readonly runtime: OwnerRuntime;
};

/**
 * Shared durable store (simulated AccessHandlePoolVFS) plus the in-process
 * broker every tab elects its owner through. Boots before any tab.
 */
export const sqlWebStoreNode = defineNodeKind<
  SqlWebStoreHandle,
  SqlWebStoreHandle,
  SqlClientWebState
>({
  id: 'sql-client.web.store',
  boot: (ctx) => {
    const store = createSimOpfsStore({
      capacity: Number(ctx.knobs.get('poolCapacity')),
    });
    const broker = createBrokerCore({
      setTimeout: (fn, ms) => ctx.deps.timers.setTimeout(fn, ms),
      clearTimeout: (id) => ctx.deps.timers.clearTimeout(id),
      now: () => ctx.deps.clock.now(),
    });
    ctx.state.backend = ctx.knobs.get('backend') as SqlClientWebBackend;
    ctx.state.epoch = Number(ctx.knobs.get('schemaEpoch'));
    ctx.state.store = store;
    ctx.state.broker = broker;
    return { store, broker };
  },
  view: (handle) => handle,
});

/**
 * One browser tab. It only opens its owner runtime while the broker elects it.
 * Recovery stays in-process (`notifyPeersOnRecover: false`) because the
 * BroadcastChannel handshake would park forever on virtual time.
 */
export const sqlWebTabNode = defineNodeKind<
  SqlWebTabHandle,
  SqlWebTabHandle,
  SqlClientWebState
>({
  id: 'sql-client.web.tab',
  boot: (ctx) => {
    const state = ctx.state;
    const runtime = createOwnerRuntime({
      dbName: SIM_DB_NAME,
      timers: ctx.deps.timers,
      createOwner: () => createTabOwner(state),
      migrate: (client) => migrateToyKv(client, state),
      notifyPeersOnRecover: false,
    });
    state.tabs.set(ctx.nodeId, { id: ctx.nodeId, runtime, open: false });
    requireBroker(state).attachPort(tabPort(ctx.nodeId));
    return { id: ctx.nodeId, runtime };
  },
  dispose: async (handle) => {
    await handle.runtime.close();
  },
  view: (handle) => handle,
});
