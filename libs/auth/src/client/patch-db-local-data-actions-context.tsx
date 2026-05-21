import { createContext, useContext } from 'react';

export type PatchDbLocalDataActions = {
  /** Wipe the entire local SQLite (`main`) database and reload the app. */
  clearLocalDatabaseAndReload: () => Promise<void>;
};

export const PatchDbLocalDataActionsContext =
  createContext<PatchDbLocalDataActions | null>(null);

export function usePatchDbLocalDataActions(): PatchDbLocalDataActions {
  const v = useContext(PatchDbLocalDataActionsContext);
  if (v === null) {
    throw new Error(
      'usePatchDbLocalDataActions: no provider — mount under AppProviders.'
    );
  }
  return v;
}
