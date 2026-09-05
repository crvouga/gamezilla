import { useTimers } from '@pkgs/clock';
import { useCreateId } from '@pkgs/uuid';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { createEmptyNotebook, type SqlNotebookDoc } from './notebook-doc';
import { useNotebookStore } from './notebook-store-context';
import { type SqlDialect, starterSqlForDialect } from './sql-dialect';

export type NotebookDocState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly doc: SqlNotebookDoc }
  | { readonly status: 'error'; readonly message: string };

export function useNotebookDoc(args: {
  readonly nodeId: string;
  readonly dialect: SqlDialect;
  readonly active: boolean;
}): {
  readonly state: NotebookDocState;
  readonly setDoc: Dispatch<SetStateAction<SqlNotebookDoc>>;
  readonly resetDoc: () => void;
} {
  const { nodeId, dialect, active } = args;
  const store = useNotebookStore();
  const createId = useCreateId();
  const timers = useTimers();
  const [state, setState] = useState<NotebookDocState>({ status: 'loading' });
  const saveHandle = useRef<unknown>(null);
  const nodeIdRef = useRef(nodeId);
  nodeIdRef.current = nodeId;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const loaded = await store.load(nodeId);
        if (cancelled) return;
        if (loaded !== null) {
          setState({ status: 'ready', doc: loaded });
          return;
        }
        const doc = createEmptyNotebook({
          nodeId,
          cellId: createId(),
          starterSql: starterSqlForDialect(dialect),
        });
        setState({ status: 'ready', doc });
        await store.save(doc);
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, nodeId, dialect, store, createId]);

  const setDoc: Dispatch<SetStateAction<SqlNotebookDoc>> = useCallback(
    (updater) => {
      setState((prev) => {
        if (prev.status !== 'ready') return prev;
        const next =
          typeof updater === 'function' ? updater(prev.doc) : updater;
        scheduleSave(store, timers, saveHandle, next);
        return { status: 'ready', doc: next };
      });
    },
    [store, timers]
  );

  const resetDoc = useCallback(() => {
    const doc = createEmptyNotebook({
      nodeId: nodeIdRef.current,
      cellId: createId(),
      starterSql: starterSqlForDialect(dialect),
    });
    setDoc(doc);
  }, [createId, dialect, setDoc]);

  return { state, setDoc, resetDoc };
}

function scheduleSave(
  store: ReturnType<typeof useNotebookStore>,
  timers: ReturnType<typeof useTimers>,
  handleRef: { current: unknown },
  doc: SqlNotebookDoc
): void {
  if (handleRef.current != null) timers.clearTimeout(handleRef.current);
  handleRef.current = timers.setTimeout(() => {
    void store.save(doc);
  }, 300);
}
