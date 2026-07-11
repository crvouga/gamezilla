import type { WriteRunResult, WriteStore } from '../shared/write-store';

type StoredRow = Record<string, unknown>;

export function createInMemoryWriteStore(
  initialRows: Readonly<Record<string, StoredRow>> = {}
): WriteStore {
  const tables = new Map<string, Map<string, StoredRow>>();

  for (const [key, row] of Object.entries(initialRows)) {
    const slash = key.indexOf('/');
    const table = key.slice(0, slash);
    const id = key.slice(slash + 1);
    let tableMap = tables.get(table);
    if (tableMap === undefined) {
      tableMap = new Map();
      tables.set(table, tableMap);
    }
    tableMap.set(id, { ...row });
  }

  const store: WriteStore = {
    query: async <T>(sql: string, params: readonly unknown[] = []) => {
      void sql;
      void params;
      return [] as T[];
    },
    run: async (sql: string, params: readonly unknown[] = []) => {
      void sql;
      void params;
      return { changes: 0 } satisfies WriteRunResult;
    },
    transaction: async (fn) => fn(store),
  };

  return store;
}
