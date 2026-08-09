import { createContext, type ReactNode, useContext, useMemo } from 'react';

import type { Clock, Timers } from './types';

export type ClockContextValue = {
  readonly clock: Clock;
  readonly timers: Timers;
};

const Ctx = createContext<ClockContextValue | null>(null);

export type ClockProviderProps = {
  readonly children: ReactNode;
  readonly clock: Clock;
  readonly timers: Timers;
};

/**
 * Injects {@link Clock} + {@link Timers} for the React tree.
 * Both are required — construct wall/sim clocks at a composition root.
 */
export function ClockProvider({
  children,
  clock,
  timers,
}: ClockProviderProps): ReactNode {
  const value = useMemo<ClockContextValue>(
    () => ({ clock, timers }),
    [clock, timers]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClockContext(): ClockContextValue {
  const v = useContext(Ctx);
  if (v === null) {
    throw new Error(
      'useClockContext: ClockProvider missing — wrap the tree with ClockProvider'
    );
  }
  return v;
}

export function useClock(): Clock {
  return useClockContext().clock;
}

export function useTimers(): Timers {
  return useClockContext().timers;
}
