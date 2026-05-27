import { createContext, useContext } from 'react';

import type { Kv } from './interface';

const KvContext = createContext<Kv | null>(null);

export function useKv(): Kv {
  const v = useContext(KvContext);
  if (v === null) {
    throw new Error('useKv: KvContext.Provider missing');
  }
  return v;
}

/**
 * Returns the ambient {@link Kv} or `null` when no provider is mounted.
 * Use for components that should degrade gracefully without persistence
 * (storybook previews, isolated unit tests, etc.).
 */
export function useKvOptional(): Kv | null {
  return useContext(KvContext);
}

export const KvContextProvider = KvContext.Provider;
