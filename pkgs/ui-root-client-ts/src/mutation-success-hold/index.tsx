/** @jsxImportSource solid-js */

import { createContext, type JSX, untrack, useContext } from 'solid-js';

const MutationSuccessHoldContext = createContext<number | null>(null);

export type MutationSuccessHoldProviderProps = {
  readonly successHoldMs: number;
  readonly children: JSX.Element;
};

/**
 * Composition-root projection of `ClientEnv.mutationSuccessHoldMs`.
 * Only the client env provider mounts this; `useMutationButton` reads it
 * when `successHoldMs` is omitted.
 */
export function MutationSuccessHoldProvider(
  props: MutationSuccessHoldProviderProps
): JSX.Element {
  // Static composition-root config: read once by design.
  const holdMs = untrack(() => props.successHoldMs);
  return (
    <MutationSuccessHoldContext.Provider value={holdMs}>
      {props.children}
    </MutationSuccessHoldContext.Provider>
  );
}

/** Env-projected hold, or `null` when no provider is mounted. */
export function useMutationSuccessHoldMs(): number | null {
  return useContext(MutationSuccessHoldContext);
}
