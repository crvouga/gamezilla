import { useLingui } from '@lingui/react/macro';
import { useClock } from '@pkgs/clock';
import { useEffect, useState } from 'react';

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

export function useRelativeTimeLabel(at: string): string {
  const { t } = useLingui();
  const clock = useClock();
  const [nowMs, setNowMs] = useState(() => clock.now());
  useEffect(() => {
    setNowMs(clock.now());
  }, [at, clock]);
  const label = formatRelativeTime(at, nowMs, t);
  return label.trim().length > 0 ? label : t`just now`;
}
