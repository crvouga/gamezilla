import { createContext, useContext, type ReactNode } from 'react';

import type { ObjectStore } from './interface';

const Ctx = createContext<ObjectStore | null>(null);

/**
 * React provider for an {@link ObjectStore}. Mount once near the app root
 * with the platform-appropriate implementation (e.g.
 * {@link ./impl-expo-file-system.ts ObjectStoreImplExpoFileSystem} for the
 * Expo client). Consumers read it via {@link useObjectStore}.
 */
export function ObjectStoreProvider({
  value,
  children,
}: {
  value: ObjectStore;
  children: ReactNode;
}): ReactNode {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useObjectStore(): ObjectStore {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useObjectStore: provider missing — mount inside AppProviders'
    );
  }
  return v;
}
