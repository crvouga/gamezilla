import { useTimers } from '@pkgs/clock-client/solid';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

/** Allow the host's admission to finish before declaring a new preview offline. */
export function useConfirmedHostAbsence(
  absent: Accessor<boolean>
): Accessor<boolean> {
  const timers = useTimers();
  const [confirmed, setConfirmed] = createSignal(false);
  createEffect(() => {
    setConfirmed(false);
    if (!absent()) return;
    const timer = timers.setTimeout(() => setConfirmed(true), 2_000);
    onCleanup(() => timers.clearTimeout(timer));
  });
  return confirmed;
}
