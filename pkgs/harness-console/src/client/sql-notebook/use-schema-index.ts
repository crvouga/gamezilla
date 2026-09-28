import { useTimers } from '@pkgs/clock/solid';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';

import {
  listProductHarnessTables,
  loadColumnNames,
  type SchemaRow,
} from './sql-schema-query';

export type SchemaWakeSubscribe = (
  listener: (label: string) => void
) => () => void;

export type SchemaIndex = {
  readonly tables: () => readonly SchemaRow[];
  readonly columnsByTable: () => Readonly<Record<string, readonly string[]>>;
  readonly allColumns: () => readonly string[];
  readonly status: () => 'loading' | 'ready' | 'error';
  readonly error: () => string | null;
  readonly refresh: () => void;
};

export function useSchemaIndex(args: {
  readonly sqlClient: SqlClient;
  readonly active: Accessor<boolean>;
  readonly reloadToken?: Accessor<number>;
  readonly subscribeDomainWake?: Accessor<SchemaWakeSubscribe | undefined>;
}): SchemaIndex {
  const { sqlClient, active, reloadToken, subscribeDomainWake } = args;
  const timers = useTimers();
  const [tables, setTables] = createSignal<readonly SchemaRow[]>([]);
  const [columnsByTable, setColumnsByTable] = createSignal<
    Readonly<Record<string, readonly string[]>>
  >({});
  const [status, setStatus] = createSignal<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  let gen = 0;
  const reload = reloadToken ?? (() => 0);

  const refresh = (): void => {
    if (!active()) return;
    const my = ++gen;
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    void (async () => {
      try {
        const nextTables = await listProductHarnessTables(sqlClient);
        const cols: Record<string, readonly string[]> = {};
        for (const t of nextTables) {
          cols[t.name] = await loadColumnNames(sqlClient, t.name);
        }
        if (my !== gen) return;
        setTables(nextTables);
        setColumnsByTable(cols);
        setStatus('ready');
        setErrorMsg(null);
      } catch (err) {
        if (my !== gen) return;
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    })();
  };

  createEffect(() => {
    if (!active()) return;
    void reload();
    refresh();
  });

  createEffect(() => {
    const subscribe =
      subscribeDomainWake === undefined ? undefined : subscribeDomainWake();
    if (!active() || subscribe === undefined) return;
    let handle: unknown = null;
    const unsub = subscribe(() => {
      if (handle != null) timers.clearTimeout(handle);
      handle = timers.setTimeout(() => refresh(), 50);
    });
    onCleanup(() => {
      unsub();
      if (handle != null) timers.clearTimeout(handle);
    });
  });

  const allColumns = createMemo(() => uniqueColumns(columnsByTable()));

  return {
    tables,
    columnsByTable,
    allColumns,
    status,
    error: errorMsg,
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
