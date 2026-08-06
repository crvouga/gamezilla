import type { Sql } from '@pkgs/sql';
import type {
  PreparedStatement,
  SqlClient,
} from '@pkgs/sql-client/interface';
import type { TableChangeBus } from '@pkgs/queries/client/table-change-bus';

function changedTable(sqlText: string): string | null {
  const match =
    /\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+["`[]?([a-z_][a-z0-9_]*)/iu.exec(
      sqlText
    );
  return match?.[1] ?? null;
}

function recordChange(changed: Set<string>, query: Sql<unknown>): void {
  const table = changedTable(query.sql);
  if (table !== null) changed.add(table);
}

function trackedPrepared<T extends Record<string, unknown>>(
  prepared: PreparedStatement<T>,
  query: Sql<T>,
  changed: Set<string>,
  emit: () => void
): PreparedStatement<T> {
  return {
    query: (params) => prepared.query(params),
    run: async (params) => {
      const result = await prepared.run(params);
      recordChange(changed, query);
      emit();
      return result;
    },
  };
}

function transactionClient(db: SqlClient, changed: Set<string>): SqlClient {
  return {
    connect: () => db.connect(),
    disconnect: () => Promise.resolve(),
    query: (query) => db.query(query),
    run: async (query) => {
      const result = await db.run(query);
      recordChange(changed, query);
      return result;
    },
    prepare: (query) =>
      trackedPrepared(db.prepare(query), query, changed, () => undefined),
    transaction: async (fn) => fn(transactionClient(db, changed)),
  };
}

/** Wraps app writes so table notifications are emitted only after commit. */
export function createTableChangeSqlClient(
  db: SqlClient,
  bus: TableChangeBus
): SqlClient {
  return {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: (query) => db.query(query),
    run: async (query) => {
      const result = await db.run(query);
      const table = changedTable(query.sql);
      if (table !== null) bus.emit([table]);
      return result;
    },
    prepare: (query) => {
      const changed = new Set<string>();
      return trackedPrepared(db.prepare(query), query, changed, () => {
        bus.emit([...changed]);
        changed.clear();
      });
    },
    transaction: async (fn) => {
      const changed = new Set<string>();
      const result = await db.transaction(async (tx) =>
        fn(transactionClient(tx, changed))
      );
      bus.emit([...changed]);
      return result;
    },
  };
}
