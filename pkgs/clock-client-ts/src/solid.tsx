/** @jsxImportSource solid-js */

import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  type ParentProps,
} from 'solid-js';

export type ClockContextValue = {
  readonly clock: Clock;
  readonly timers: Timers;
};

const ClockContext = defineContext<ClockContextValue>('Clock');

export type ClockProviderProps = ParentProps<ClockContextValue>;

/**
 * Injects {@link Clock} + {@link Timers} for the Solid tree.
 * Both are required — construct wall/harness clocks at a composition root.
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

/**
 * A reactive value that depends on the time. `compute` reads the clock fresh
 * whenever its own inputs change, and `changesAt` names the next instant the
 * value would change with nothing else changing; a single timer re-reads it
 * then. No polling: a value time never changes costs no timer at all.
 */
export function createTimedValue<T>(
  compute: (nowMs: number) => T,
  changesAt: (value: T, nowMs: number) => number | null
): Accessor<T> {
  const clock = useClock();
  const timers = useTimers();
  const [tick, setTick] = createSignal(0);
  const reading = createMemo(() => {
    tick();
    const nowMs = clock.now();
    const value = compute(nowMs);
    return { value, nowMs, at: changesAt(value, nowMs) };
  });
  createEffect(() => {
    const { at, nowMs } = reading();
    if (at === null) return;
    const handle = timers.setTimeout(
      () => setTick((n) => n + 1),
      Math.max(0, at - nowMs)
    );
    onCleanup(() => timers.clearTimeout(handle));
  });
  return () => reading().value;
}
