/** @jsxImportSource solid-js */
/**
 * Live relative-time label ("3m ago") via injected `Clock` / `Timers`.
 *
 * Re-evaluates every {@link RELATIVE_TIME_TICK_MS} and whenever `at` changes.
 */

import { useLingui } from '@lingui/solid/macro';
import { useClock, useTimers } from '@pkgs/clock-client-ts/solid';
import {
  RELATIVE_TIME_TICK_MS,
  relativeTimeParts,
} from '@pkgs/ui-root-shared-ts/relative-time-format';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';

/** `clock.now()` sampled on mount, on every `restart` change, and every tick. */
function createLiveNow(restart: Accessor<unknown>): Accessor<number> {
  const clock = useClock();
  const timers = useTimers();
  const [nowMs, setNowMs] = createSignal(clock.now());
  createEffect(
    on(restart, () => {
      setNowMs(clock.now());
      const id = timers.setInterval(() => {
        setNowMs(clock.now());
      }, RELATIVE_TIME_TICK_MS);
      onCleanup(() => {
        timers.clearInterval(id);
      });
    })
  );
  return nowMs;
}

/**
 * Live relative-time label that re-evaluates on an injected timer tick.
 * `at` is an accessor so a changing timestamp restarts the interval.
 */
export function useRelativeTimeLabel(at: Accessor<string>): Accessor<string> {
  const { t } = useLingui();
  const nowMs = createLiveNow(at);
  const parts = createMemo(() => relativeTimeParts(at(), nowMs()));
  return () => {
    const p = parts();
    switch (p.kind) {
      case 'raw':
        return p.value;
      case 'minutes': {
        const mins = p.value;
        return t`${mins}m ago`;
      }
      case 'hours': {
        const hours = p.value;
        return t`${hours}h ago`;
      }
      case 'days': {
        const days = p.value;
        return t`${days}d ago`;
      }
      default:
        return t`just now`;
    }
  };
}
