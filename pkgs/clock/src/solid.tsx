/** @jsxImportSource solid-js */
import { defineContext } from '@pkgs/solid-context/define-context';
import type { JSX, ParentProps } from 'solid-js';

import type { Clock, Timers } from './types';

export type ClockContextValue = {
  readonly clock: Clock;
  readonly timers: Timers;
};

const ClockContext = defineContext<ClockContextValue>('Clock');

export type ClockProviderProps = ParentProps<ClockContextValue>;

/**
 * Injects {@link Clock} + {@link Timers} for the Solid tree.
 * Both are required — construct wall/sim clocks at a composition root.
 */
export function ClockProvider(props: ClockProviderProps): JSX.Element {
  // Services are stable handles; the props object itself is the context value.
  return (
    <ClockContext.Provider value={props}>
      {props.children}
    </ClockContext.Provider>
  );
}

export function useClockContext(): ClockContextValue {
  return ClockContext.use();
}

export function useClock(): Clock {
  return ClockContext.use().clock;
}

export function useTimers(): Timers {
  return ClockContext.use().timers;
}
