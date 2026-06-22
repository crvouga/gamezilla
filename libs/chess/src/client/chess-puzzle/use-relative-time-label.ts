import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';

function formatRelativeTime(
  at: string,
  nowMs: number,
  t: (strings: TemplateStringsArray, ...values: readonly number[]) => string
): string {
  const then = Date.parse(at);
  if (!Number.isFinite(then)) return at;
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
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    setNowMs(Date.now());
  }, [at]);
  if (nowMs === 0) return at;
  return formatRelativeTime(at, nowMs, t);
}
