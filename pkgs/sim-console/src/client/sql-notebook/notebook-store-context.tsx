import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { createNotebookStore, type NotebookStore } from './notebook-store';

const Ctx = createContext<NotebookStore | null>(null);

export function NotebookStoreProvider(props: {
  readonly store?: ObjectStore;
  readonly children: ReactNode;
}): ReactNode {
  const value = useMemo(
    () => createNotebookStore(props.store ?? new ObjectStoreImplInMemory()),
    [props.store]
  );
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
