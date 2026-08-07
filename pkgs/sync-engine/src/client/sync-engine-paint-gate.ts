import { createContext } from 'react';

/**
 * Whether SyncEngineBoot is serving an engine whose identity matches this
 * tab's selected account (not a sticky prior-account engine during switch).
 * Read via {@link useSyncEngine}.paintReady — do not import a paint hook.
 */
export const SyncEnginePaintGateContext = createContext(true);
