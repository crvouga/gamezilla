/**
 * Composition-root projection of ClientEnv.mutationSuccessHoldMs.
 * Not part of the public `@pkgs/ui-rn` barrel — only ClientEnvProvider mounts this;
 * useMutationButton reads it when `successHoldMs` is omitted.
 */

import { createContext, type ReactNode, useContext } from 'react';

const MutationSuccessHoldContext = createContext<number | null>(null);

export type MutationSuccessHoldProviderProps = {
  readonly successHoldMs: number;
  readonly children: ReactNode;
};

export function MutationSuccessHoldProvider({
  successHoldMs,
  children,
}: MutationSuccessHoldProviderProps): ReactNode {
  return (
    <MutationSuccessHoldContext.Provider value={successHoldMs}>
      {children}
    </MutationSuccessHoldContext.Provider>
  );
}

/** Env-projected hold, or `null` when ClientEnvProvider is absent. */
export function useMutationSuccessHoldMs(): number | null {
  return useContext(MutationSuccessHoldContext);
}
