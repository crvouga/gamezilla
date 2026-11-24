import { useTimers } from '@pkgs/clock-client-ts/solid';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import type { SchemaRow } from './sql-schema-query';
import {
  listProductHarnessTables,
  loadColumnNamesByTable,
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
  readonly sqlClient: Accessor<SqlClient>;
  readonly active: Accessor<boolean>;
  readonly reloadToken?: Accessor<number>;
  readonly subscribeDomainWake?: Accessor<SchemaWakeSubscribe | undefined>;
}): SchemaIndex {
  const { sqlClient, reloadToken, subscribeDomainWake } = args;
  // A memo: a caller's `active` may be notified without having changed, and
  // reading the whole schema again is too much work to do for nothing.
  const active = createMemo(() => args.active());
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

  const load = (client: SqlClient): void => {
    const my = ++gen;
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    void (async () => {
      try {
        const nextTables = await listProductHarnessTables(client);
        const cols = await loadColumnNamesByTable(
          client,
          nextTables.map((t) => t.name)
        );
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

  const refresh = (): void => {
    if (active()) load(sqlClient());
  };

  createEffect(
    () => (active() ? { token: reload(), client: sqlClient() } : null),
    (wanted) => {
      if (wanted !== null) load(wanted.client);
    }
  );

  createEffect(
    () => (active() ? subscribeDomainWake?.() : undefined),
    (subscribe) => {
      if (subscribe === undefined) return;
      let handle: unknown = null;
      const unsub = subscribe(() => {
        if (handle != null) timers.clearTimeout(handle);
        handle = timers.setTimeout(() => refresh(), 50);
      });
      return () => {
        unsub();
        if (handle != null) timers.clearTimeout(handle);
      };
    }
  );

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
