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
}): {
  readonly state: DbState;
  readonly selectTable: (name: string) => void;
} {
  const { sqlClient, reloadToken } = args;
  const timers = useTimers();
  const [state, setState] = useState<DbState>({ status: 'loading' });
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === 'ready') {
      selectedRef.current = state.selected;
    }
  }, [state]);

  useSchemaSoftPoll(sqlClient, timers, selectedRef, setState);
  useReloadTokenEffect(sqlClient, reloadToken, selectedRef, setState);

  const selectTable = (name: string) => {
    selectedRef.current = name;
    void loadSelectedTable(sqlClient, name, setState);
  };

  return { state, selectTable };
}

function useSchemaSoftPoll(
  sqlClient: SqlClient,
  timers: ReturnType<typeof useTimers>,
  selectedRef: MutableRefObject<string | null>,
  setState: Dispatch<SetStateAction<DbState>>
) {
  useEffect(() => {
    let cancelled = false;
    const softReload = async () => {
      try {
        const next = await fetchSchemaState(sqlClient, selectedRef.current);
        if (!cancelled) {
          selectedRef.current = next.selected;
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
    setState({ status: 'loading' });
    void softReload();
    const handle = timers.setInterval(() => {
      void softReload();
    }, 500);
    return () => {
      cancelled = true;
      timers.clearInterval(handle);
    };
  }, [sqlClient, timers, selectedRef, setState]);
}

function useReloadTokenEffect(
  sqlClient: SqlClient,
  reloadToken: number,
  selectedRef: MutableRefObject<string | null>,
  setState: Dispatch<SetStateAction<DbState>>
) {
  const ready = useRef(false);
  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchSchemaState(sqlClient, selectedRef.current);
        if (!cancelled) {
          selectedRef.current = next.selected;
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
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, sqlClient, selectedRef, setState]);
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
