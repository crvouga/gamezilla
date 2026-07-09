const DEFAULT_THRESHOLDS_MS: Readonly<Record<string, number>> = {
  'db.query': 100,
  'db.transaction': 250,
  'sync.upload': 200,
  'http.server.request': 500,
  'http.client.request': 500,
};

function envKeyForSpan(spanName: string): string {
  const normalized = spanName.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
  return `OBSERVABILITY_SLOW_MS_${normalized}`;
}

function readEnvThresholdMs(spanName: string): number | null {
  const raw = process.env[envKeyForSpan(spanName)];
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function slowThresholdMsForSpan(spanName: string): number {
  return readEnvThresholdMs(spanName) ?? DEFAULT_THRESHOLDS_MS[spanName] ?? 500;
}

export function isSlowSpan(spanName: string, durationMs: number): boolean {
  return durationMs >= slowThresholdMsForSpan(spanName);
}

export const SlowSpanSemconv = {
  slow: 'performance.slow',
  durationMs: 'performance.duration_ms',
  thresholdMs: 'performance.threshold_ms',
} as const;
