import { ObjectStoreImplInMemory } from '@pkgs/object-store-shared/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import {
  createContext,
  createMemo,
  type JSX,
  type ParentProps,
  useContext,
} from 'solid-js';
import type { NotebookStore } from './notebook-store';
import { createNotebookStore } from './notebook-store';

const Ctx = createContext<NotebookStore | null>(null);

export function NotebookStoreProvider(
  props: ParentProps<{ readonly store?: ObjectStore }>
): JSX.Element {
  const store = createMemo(() =>
    createNotebookStore(props.store ?? new ObjectStoreImplInMemory())
  );
  const value: NotebookStore = {
    load: (nodeId) => store().load(nodeId),
    save: (doc) => store().save(doc),
    clear: (nodeId) => store().clear(nodeId),
  };
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useNotebookStore(): NotebookStore {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useNotebookStore: provider missing — mount NotebookStoreProvider'
    );
  }
  return v;
}
