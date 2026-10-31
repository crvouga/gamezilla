/** @jsxImportSource solid-js */

import { useClock } from '@pkgs/clock-client-ts/solid';
import { ACTIVITY_REVOLUTION_MS } from '@pkgs/ui-root-shared-ts/activity-indicator';
import { createContext, type JSX, useContext } from 'solid-js';

/** One full revolution (matches `spinner.module.css`). */
export const SPIN_DURATION_MS = ACTIVITY_REVOLUTION_MS;

type SpinnerContextValue = {
  /** Phase offset (ms, 0 ≤ n < SPIN_DURATION_MS) for a spinner mounting now. */
  phaseOffsetMs: () => number;
};

const SpinnerContext = createContext<SpinnerContextValue | null>(null);

/**
 * `SpinnerProvider` -- keeps spinner rotation phase continuous across remounts.
 *
 * CSS animations restart from 0° whenever an element mounts, so swapping
 * between sibling loading states (list → detail → list) visibly snaps the
 * petals back. The provider records one origin timestamp from the injected
 * `Clock`; every `Spinner` under it starts its animation with a negative
 * `animation-delay` equal to the elapsed phase, so all instances share one
 * virtual timeline. Opt-in: without a provider each spinner starts at 0°.
 */
export function SpinnerProvider(props: { children: JSX.Element }): JSX.Element {
  const clock = useClock();
  const origin = clock.now();
  const value: SpinnerContextValue = {
    phaseOffsetMs: () => (clock.now() - origin) % SPIN_DURATION_MS,
  };
  return (
    <SpinnerContext.Provider value={value}>
      {props.children}
    </SpinnerContext.Provider>
  );
}

/**
 * `animation-delay` for a spinner mounting now, or `undefined` without a
 * provider (fresh 0° start).
 */
export function useSharedSpinnerDelay(): string | undefined {
  const ctx = useContext(SpinnerContext);
  if (ctx === null) return undefined;
  const offset = ctx.phaseOffsetMs();
  return offset === 0 ? undefined : `-${offset}ms`;
}
