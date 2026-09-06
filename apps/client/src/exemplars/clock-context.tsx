/** @jsxImportSource solid-js */
import type { Clock, Timers } from '@pkgs/clock/types';
import { createContext, type ParentProps, useContext } from 'solid-js';

export type ClockServices = {
  readonly clock: Clock;
  readonly timers: Timers;
};

const ClockContext = createContext<ClockServices>();

/**
 * Exemplar of service injection: time is a context value, never a wall global.
 * (Phase 2 moves this into `@pkgs/clock/solid`.)
 */
export function ClockProvider(props: ParentProps<ClockServices>) {
  // The props object itself is the context value (services are stable).
  return (
    <ClockContext.Provider value={props}>
      {props.children}
    </ClockContext.Provider>
  );
}

export function useClockServices(): ClockServices {
  const ctx = useContext(ClockContext);
  if (ctx === undefined) {
    throw new Error('useClockServices must be used within ClockProvider');
  }
  return ctx;
}
