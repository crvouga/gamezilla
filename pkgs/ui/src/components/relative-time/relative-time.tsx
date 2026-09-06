/** @jsxImportSource solid-js */
/**
 * `RelativeTime` -- live "3m ago" label.
 *
 * Time comes only from the injected `Clock` / `Timers` (`@pkgs/clock/solid`):
 * the label re-evaluates every {@link RELATIVE_TIME_TICK_MS} on the injected
 * interval and whenever `at` changes. Renders a `<time dateTime>` element.
 */

import { useLingui } from '@lingui/solid/macro';
import { useClock, useTimers } from '@pkgs/clock/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
} from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Text, type TextVariant } from '../text';
import {
  RELATIVE_TIME_TICK_MS,
  relativeTimeParts,
} from './relative-time-format';

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

export type RelativeTimeProps = {
  /** ISO timestamp (or any `Date.parse`-able string). */
  at: string;
  variant?: TextVariant | undefined;
  sx?: SxInput | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function RelativeTime(props: RelativeTimeProps): JSX.Element {
  const label = useRelativeTimeLabel(() => props.at);
  let host: HTMLElement | undefined;
  // `<time datetime>` is not part of the generic `Text` attribute surface.
  createEffect(() => {
    host?.setAttribute('datetime', props.at);
  });
  return (
    <Text
      as="time"
      ref={(el) => {
        host = el;
      }}
      variant={props.variant ?? 'caption'}
      label={label()}
      sx={props.sx}
      dataSet={{ component: 'RelativeTime', ...props.dataSet }}
    />
  );
}
