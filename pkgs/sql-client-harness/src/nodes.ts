import type { Session } from '@pkgs/harness-shared/runtime-types';
import { createLogger } from '@pkgs/logger-shared/logger';
import type { BrokerCore } from '@pkgs/sql-client-sqlite-web-shared/broker-core';
import { createBrokerCore } from '@pkgs/sql-client-sqlite-web-shared/broker-core';
import type { HarnessOpfsStore } from '@pkgs/sql-client-sqlite-web-shared/harness-opfs-sql-owner';
import { createHarnessOpfsStore } from '@pkgs/sql-client-sqlite-web-shared/harness-opfs-sql-owner';
import type { OwnerRuntime } from '@pkgs/sql-client-sqlite-web-shared/owner-runtime';
import { createOwnerRuntime } from '@pkgs/sql-client-sqlite-web-shared/owner-runtime';
import { createTabOwner } from './owners';
import { tabPort } from './ownership';
import { migrateToyKv } from './toy-kv';
import type { SqlClientWebBackend, SqlClientWebState } from './types';
import {
  createSqlClientWebState,
  HARNESS_DB_NAME,
  requireBroker,
} from './types';

export type SqlWebStoreHandle = {
  readonly store: HarnessOpfsStore;
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
  const store = createHarnessOpfsStore({ capacity: opts.poolCapacity });
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
    dbName: HARNESS_DB_NAME,
    timers: session.ports.timers,
    logger: createLogger({
      name: 'sqlite-web',
      now: () => session.ports.clock.now(),
    }),
    createOwner: () => createTabOwner(board),
    migrate: (client) => migrateToyKv(client, board),
  });
  board.tabs.set(id, { id, runtime, open: false });
  requireBroker(board).attachPort(tabPort(id));
  return { id, runtime };
}
