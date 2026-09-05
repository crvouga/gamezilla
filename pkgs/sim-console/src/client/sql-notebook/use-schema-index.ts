import { useTimers } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  listPlaygroundTables,
  loadColumnNames,
  type SchemaRow,
} from './sql-schema-query';

export type SchemaIndex = {
  readonly tables: readonly SchemaRow[];
  readonly columnsByTable: Readonly<Record<string, readonly string[]>>;
  readonly allColumns: readonly string[];
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly refresh: () => void;
};

export function useSchemaIndex(args: {
  readonly sqlClient: SqlClient;
  readonly active: boolean;
  readonly reloadToken?: number;
  readonly subscribeDomainWake?: (
    listener: (label: string) => void
  ) => () => void;
}): SchemaIndex {
  const { sqlClient, active, reloadToken = 0, subscribeDomainWake } = args;
  const timers = useTimers();
  const [tables, setTables] = useState<readonly SchemaRow[]>([]);
  const [columnsByTable, setColumnsByTable] = useState<
    Readonly<Record<string, readonly string[]>>
  >({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [error, setError] = useState<string | null>(null);
  const gen = useRef(0);

  const refresh = useCallback(() => {
    if (!active) return;
    const my = ++gen.current;
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    void (async () => {
      try {
        const nextTables = await listPlaygroundTables(sqlClient);
        const cols: Record<string, readonly string[]> = {};
        for (const t of nextTables) {
          cols[t.name] = await loadColumnNames(sqlClient, t.name);
        }
        if (my !== gen.current) return;
        setTables(nextTables);
        setColumnsByTable(cols);
        setStatus('ready');
        setError(null);
      } catch (err) {
        if (my !== gen.current) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [active, sqlClient]);

  useEffect(() => {
    refresh();
  }, [refresh, reloadToken]);

  useEffect(() => {
    if (!active || subscribeDomainWake === undefined) return;
    let handle: unknown = null;
    const unsub = subscribeDomainWake(() => {
      if (handle != null) timers.clearTimeout(handle);
      handle = timers.setTimeout(() => {
        refresh();
      }, 50);
    });
    return () => {
      unsub();
      if (handle != null) timers.clearTimeout(handle);
    };
  }, [active, subscribeDomainWake, refresh, timers]);

  const allColumns = uniqueColumns(columnsByTable);
  return {
    tables,
    columnsByTable,
    allColumns,
    status,
    error,
    refresh,
  };
}

function uniqueColumns(
  columnsByTable: Readonly<Record<string, readonly string[]>>
): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const cols of Object.values(columnsByTable)) {
    for (const c of cols) {
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}
