import { useLingui } from '@lingui/react/macro';
import { useClock, useTimers } from '@pkgs/clock';
import { useEffect, useState } from 'react';

import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Text, type TextVariant } from '../text';

const TICK_INTERVAL_MS = 30_000;

function formatRelativeTime(
  at: string,
  nowMs: number,
  t: (strings: TemplateStringsArray, ...values: readonly number[]) => string
): string {
  const then = Date.parse(at);
  if (!Number.isFinite(then)) {
    const trimmed = at.trim();
    return trimmed.length > 0 ? trimmed : t`just now`;
  }
  const diffMs = nowMs - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return t`just now`;
  if (mins < 60) return t`${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t`${hours}h ago`;
  const days = Math.floor(hours / 24);
  return t`${days}d ago`;
}

/**
 * Live relative-time label that re-renders on an injectable timer tick.
 */
export function useRelativeTimeLabel(at: string): string {
  const { t } = useLingui();
  const clock = useClock();
  const timers = useTimers();
  const [nowMs, setNowMs] = useState(() => clock.now());

  useEffect(() => {
    setNowMs(clock.now());
    const id = timers.setInterval(() => {
      setNowMs(clock.now());
    }, TICK_INTERVAL_MS);
    return () => {
      timers.clearInterval(id);
    };
  }, [at, clock, timers]);

  const label = formatRelativeTime(at, nowMs, t);
  return label.trim().length > 0 ? label : t`just now`;
}

export type RelativeTimeProps = {
  /** ISO timestamp (or any `Date.parse`-able string). */
  at: string;
  variant?: TextVariant;
  sx?: SxInput;
  dataSet?: ComponentDataSet;
};

export function RelativeTime({
  at,
  variant = 'caption',
  sx,
  dataSet,
}: RelativeTimeProps) {
  const label = useRelativeTimeLabel(at);
  return (
    <Text
      variant={variant}
      label={label}
      {...(sx !== undefined ? { sx } : {})}
      dataSet={{ component: 'RelativeTime', ...dataSet }}
    />
  );
}
