import { createContext, type ReactNode, useContext, useMemo } from 'react';

import type { Io } from './types';

const Ctx = createContext<Io | null>(null);

export type IoProviderProps = {
  readonly children: ReactNode;
  /** Required — construct via wallIo / createSimIo at a composition root. */
  readonly io: Io;
};

/**
 * Injects a single {@link Io} bag for the React tree.
 * Prefer composing {@link IoProvider} at the app root; feature code uses {@link useIo}.
 */
export function IoProvider({ children, io }: IoProviderProps): ReactNode {
  const value = useMemo(() => io, [io]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Current {@link Io} — throws if {@link IoProvider} is missing. */
export function useIo(): Io {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useIo: IoProvider missing — wrap the tree with IoProvider'
    );
  }
  return v;
}

/** Current {@link Io} or `null` when outside {@link IoProvider}. */
export function useIoOptional(): Io | null {
  return useContext(Ctx);
}
