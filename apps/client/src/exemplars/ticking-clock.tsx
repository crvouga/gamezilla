/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import { createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useClockServices } from './clock-context';

export type TickingClockProps = {
  intervalMs?: number | undefined;
};

const DEFAULT_INTERVAL_MS = 1000;

/**
 * Exemplar: injected time (`Clock` / `Timers` from context — never bare
 * `Date` / `setInterval`), a signal driven by an interval, and `onCleanup`.
 */
export function TickingClock(props: TickingClockProps) {
  const { clock, timers } = useClockServices();
  const [nowMs, setNowMs] = createSignal(clock.now());
  const seconds = createMemo(() => Math.floor(nowMs() / 1000));

  onMount(() => {
    const handle = timers.setInterval(
      () => setNowMs(clock.now()),
      props.intervalMs ?? DEFAULT_INTERVAL_MS
    );
    onCleanup(() => timers.clearInterval(handle));
  });

  return (
    <output data-component="TickingClock" data-testid="ticking-clock">
      <Trans>Elapsed: {seconds()}s</Trans>
    </output>
  );
}
