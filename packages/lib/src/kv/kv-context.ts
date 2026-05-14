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

export const KvContextProvider = KvContext.Provider;
