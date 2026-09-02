import { useTimers } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  listPlaygroundTables,
  loadColumnNames,
  type SchemaRow,
} from './playground-db-query';

export type ReadyState = {
  readonly status: 'ready';
  readonly tables: readonly SchemaRow[];
  readonly selected: string | null;
  readonly columns: readonly string[];
};

export type DbState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | ReadyState;

export function usePlaygroundDbSchema(args: {
  readonly sqlClient: SqlClient;
  readonly reloadToken: number;
  /** When false, pause schema soft-poll (pane is CSS-hidden). */
  readonly active: boolean;
  /** Controlled selection from navigation state. */
  readonly selectedTable: string | null;
  /** Notify parent when the resolved table differs (e.g. first-table default). */
  readonly onSelectTable: (name: string) => void;
}): {
  readonly state: DbState;
  readonly selectTable: (name: string) => void;
} {
  const { sqlClient, reloadToken, active, selectedTable, onSelectTable } = args;
  const timers = useTimers();
  const [state, setState] = useState<DbState>({ status: 'loading' });
  const selectedRef = useRef<string | null>(selectedTable);
  selectedRef.current = selectedTable;
  const onSelectTableRef = useRef(onSelectTable);
  onSelectTableRef.current = onSelectTable;

  useSchemaSoftPoll({
    sqlClient,
    timers,
    active,
    selectedRef,
    setState,
  });
  useReloadTokenEffect({
    sqlClient,
    reloadToken,
    active,
    selectedRef,
    setState,
  });
  useSyncControlledSelection(sqlClient, selectedTable, state, setState);
  useDefaultTableSelection(state, selectedTable, onSelectTableRef);

  const selectTable = (name: string) => {
    selectedRef.current = name;
    onSelectTable(name);
    void loadSelectedTable(sqlClient, name, setState);
  };

  return { state, selectTable };
}

function useDefaultTableSelection(
  state: DbState,
  selectedTable: string | null,
  onSelectTableRef: MutableRefObject<(name: string) => void>
) {
  useEffect(() => {
    if (state.status !== 'ready') return;
    if (selectedTable != null) return;
    const first = state.tables[0]?.name;
    if (first == null) return;
    onSelectTableRef.current(first);
  }, [state, selectedTable, onSelectTableRef]);
}

function useSyncControlledSelection(
  sqlClient: SqlClient,
  selectedTable: string | null,
  state: DbState,
  setState: Dispatch<SetStateAction<DbState>>
) {
  useEffect(() => {
    if (state.status !== 'ready') return;
    if (selectedTable == null) return;
    if (state.selected === selectedTable) return;
    if (!state.tables.some((t) => t.name === selectedTable)) return;
    void loadSelectedTable(sqlClient, selectedTable, setState);
  }, [sqlClient, selectedTable, state, setState]);
}

function useSchemaSoftPoll(args: {
  readonly sqlClient: SqlClient;
  readonly timers: ReturnType<typeof useTimers>;
  readonly active: boolean;
  readonly selectedRef: MutableRefObject<string | null>;
  readonly setState: Dispatch<SetStateAction<DbState>>;
}) {
  const { sqlClient, timers, active, selectedRef, setState } = args;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const softReload = async () => {
      try {
        const next = await fetchSchemaState(sqlClient, selectedRef.current);
        if (!cancelled) {
          setState(next);
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };
    setState((prev) =>
      prev.status === 'ready' ? prev : { status: 'loading' }
    );
    void softReload();
    const handle = timers.setInterval(() => {
      void softReload();
    }, 500);
    return () => {
      cancelled = true;
      timers.clearInterval(handle);
    };
  }, [sqlClient, timers, active, selectedRef, setState]);
}

function useReloadTokenEffect(args: {
  readonly sqlClient: SqlClient;
  readonly reloadToken: number;
  readonly active: boolean;
  readonly selectedRef: MutableRefObject<string | null>;
  readonly setState: Dispatch<SetStateAction<DbState>>;
}) {
  const { sqlClient, reloadToken, active, selectedRef, setState } = args;
  const ready = useRef(false);
  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      return;
    }
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchSchemaState(sqlClient, selectedRef.current);
        if (!cancelled) setState(next);
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, sqlClient, active, selectedRef, setState]);
}

async function fetchSchemaState(
  sqlClient: SqlClient,
  preferredSelected: string | null
): Promise<ReadyState> {
  const tables = await listPlaygroundTables(sqlClient);
  const selected =
    preferredSelected != null &&
    tables.some((t) => t.name === preferredSelected)
      ? preferredSelected
      : (tables[0]?.name ?? null);
  if (selected == null) {
    return { status: 'ready', tables, selected: null, columns: [] };
  }
  const columns = await loadColumnNames(sqlClient, selected);
  return { status: 'ready', tables, selected, columns };
}

async function loadSelectedTable(
  sqlClient: SqlClient,
  name: string,
  setState: (updater: (prev: DbState) => DbState) => void
): Promise<void> {
  const columns = await loadColumnNames(sqlClient, name);
  setState((prev) => {
    if (prev.status !== 'ready') return prev;
    return { ...prev, selected: name, columns };
  });
}
