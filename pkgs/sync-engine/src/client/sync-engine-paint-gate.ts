import { createContext, useContext } from 'react';

/**
 * Whether SyncEngineBoot is serving an engine whose identity matches this
 * tab's selected account (not a sticky prior-account engine during switch).
 */
export const SyncEnginePaintGateContext = createContext(true);

export function useSyncEnginePaintReady(): boolean {
  return useContext(SyncEnginePaintGateContext);
}
