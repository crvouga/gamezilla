import { createContext, useContext } from 'solid-js';

export type SyncLocalDataActions = {
  /** Wipe the entire local SQLite (`main`) database and reload the app. */
  clearLocalDatabaseAndReload: () => Promise<void>;
};

export const SyncLocalDataActionsContext =
  createContext<SyncLocalDataActions | null>(null);

export function useSyncLocalDataActions(): SyncLocalDataActions {
  const v = useContext(SyncLocalDataActionsContext);
  if (v === null) {
    throw new Error(
      'useSyncLocalDataActions: no provider — mount under AppProviders.'
    );
  }
  return v;
}
