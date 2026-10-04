import { useTimers } from '@pkgs/clock-client/solid';
import type { Timers } from '@pkgs/clock-shared/types';
import { useCreateId } from '@pkgs/uuid-client/solid';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import type { SqlNotebookDoc } from './notebook-doc';
import { createEmptyNotebook } from './notebook-doc';
import type { NotebookStore } from './notebook-store';
import { useNotebookStore } from './notebook-store-context';
import type { SqlDialect } from './sql-dialect';
import { starterSqlForDialect } from './sql-dialect';

export type NotebookDocState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly doc: SqlNotebookDoc }
  | { readonly status: 'error'; readonly message: string };

export type NotebookDocSetter = (
  next: SqlNotebookDoc | ((prev: SqlNotebookDoc) => SqlNotebookDoc)
) => void;

export function useNotebookDoc(args: {
  readonly nodeId: Accessor<string>;
  readonly dialect: Accessor<SqlDialect>;
  readonly active: Accessor<boolean>;
}): {
  readonly state: Accessor<NotebookDocState>;
  readonly setDoc: NotebookDocSetter;
  readonly resetDoc: () => void;
} {
  const { nodeId, dialect, active } = args;
  const store = useNotebookStore();
  const createId = useCreateId();
  const timers = useTimers();
  const [state, setState] = createSignal<NotebookDocState>({
    status: 'loading',
  });
  const saveHandle: { current: unknown } = { current: null };

  createEffect(() => {
    if (!active()) return;
    const id = nodeId();
    const dialectValue = dialect();
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    setState({ status: 'loading' });
    void (async () => {
      try {
        const loaded = await store.load(id);
        if (cancelled) return;
        if (loaded !== null) {
          setState({ status: 'ready', doc: loaded });
          return;
        }
        const doc = createEmptyNotebook({
          nodeId: id,
          cellId: createId(),
          starterSql: starterSqlForDialect(dialectValue),
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
  });

  const setDoc: NotebookDocSetter = (updater) => {
    setState((prev) => {
      if (prev.status !== 'ready') return prev;
      const next = typeof updater === 'function' ? updater(prev.doc) : updater;
      scheduleSave(store, timers, saveHandle, next);
      return { status: 'ready', doc: next };
    });
  };

  const resetDoc = (): void => {
    const doc = createEmptyNotebook({
      nodeId: nodeId(),
      cellId: createId(),
      starterSql: starterSqlForDialect(dialect()),
    });
    setDoc(doc);
  };

  return { state, setDoc, resetDoc };
}

function scheduleSave(
  store: NotebookStore,
  timers: Timers,
  handleRef: { current: unknown },
  doc: SqlNotebookDoc
): void {
  if (handleRef.current != null) timers.clearTimeout(handleRef.current);
  handleRef.current = timers.setTimeout(() => {
    void store.save(doc);
  }, 300);
}
