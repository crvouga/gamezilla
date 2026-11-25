import { useTimers } from '@pkgs/clock-client-ts/solid';
import { type Accessor, createEffect, createSignal } from 'solid-js';

/** Allow the host's admission to finish before declaring a new preview offline. */
export function useConfirmedHostAbsence(
  absent: Accessor<boolean>
): Accessor<boolean> {
  const timers = useTimers();
  // Every change of `absent` starts unconfirmed.
  const [confirmed, setConfirmed] = createSignal(() => {
    absent();
    return false;
  });
  createEffect(absent, (isAbsent) => {
    if (!isAbsent) return;
    const timer = timers.setTimeout(() => setConfirmed(true), 2_000);
    return () => timers.clearTimeout(timer);
  });
  return confirmed;
}
