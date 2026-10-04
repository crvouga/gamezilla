import type { SqlClient } from '@pkgs/sql-client-shared/interface';

import { SqliteStorageFullError } from '@pkgs/sync-engine-shared/storage-full-error';

export type StoragePressureKind = 'sqliteFull' | 'tornTxnAfterStatement';

type ArmState = {
  readonly kind: StoragePressureKind;
  remaining: number;
};

/** Per-client one-shot storage / txn fault arms for DST. */
export type StoragePressureController = {
  readonly arm: (
    clientId: string,
    kind: StoragePressureKind,
    afterStatements?: number
  ) => void;
  readonly clear: (clientId?: string) => void;
  readonly wrap: (clientId: string, inner: SqlClient) => SqlClient;
};

function wrapTx(tx: SqlClient, onStatement: () => void): SqlClient {
  return {
    connect: () => tx.connect(),
    disconnect: () => tx.disconnect(),
    query: (q) => tx.query(q),
    run: async (q) => {
      onStatement();
      return tx.run(q);
    },
    prepare: (query) => {
      const prepared = tx.prepare(query);
      return {
        query: (params) => prepared.query(params),
        run: async (params) => {
          onStatement();
          return prepared.run(params);
        },
      };
    },
    transaction: (fn) => tx.transaction(fn),
  };
}

export function createStoragePressureController(): StoragePressureController {
  const arms = new Map<string, ArmState>();

  const onStatement = (clientId: string): void => {
    const state = arms.get(clientId);
    if (state === undefined) return;
    if (state.kind === 'sqliteFull') {
      arms.delete(clientId);
      throw new SqliteStorageFullError('harness: storage quota');
    }
    if (state.kind === 'tornTxnAfterStatement') {
      state.remaining -= 1;
      if (state.remaining <= 0) {
        arms.delete(clientId);
        throw new SqliteStorageFullError('harness: torn transaction');
      }
    }
  };

  return {
    arm(clientId, kind, afterStatements = 1) {
      arms.set(clientId, {
        kind,
        remaining:
          kind === 'tornTxnAfterStatement' ? Math.max(1, afterStatements) : 0,
      });
    },
    clear(clientId) {
      if (clientId === undefined) {
        arms.clear();
        return;
      }
      arms.delete(clientId);
    },
    wrap(clientId, inner) {
      const stmt = () => onStatement(clientId);
      return {
        connect: () => inner.connect(),
        disconnect: () => inner.disconnect(),
        query: (q) => inner.query(q),
        run: async (q) => {
          stmt();
          return inner.run(q);
        },
        prepare: (query) => {
          const prepared = inner.prepare(query);
          return {
            query: (params) => prepared.query(params),
            run: async (params) => {
              stmt();
              return prepared.run(params);
            },
          };
        },
        transaction: async (fn) =>
          inner.transaction(async (tx) => fn(wrapTx(tx, stmt))),
      };
    },
  };
}
