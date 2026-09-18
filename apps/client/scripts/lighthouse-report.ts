#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Parse Lighthouse LHR JSON for metric medians + banned early fetches.
 */
import type { LighthouseRouteMetrics } from './perf-budget';

export type LhrLike = {
  readonly finalUrl?: string;
  readonly requestedUrl?: string;
  readonly audits?: Record<
    string,
    {
      numericValue?: number;
      details?: {
        items?: readonly {
          url?: string;
          networkRequestTime?: number;
          rendererStartTime?: number;
          startTime?: number;
        }[];
      };
    }
  >;
};

export function metricValue(lhr: LhrLike, auditId: string): number | null {
  const v = lhr.audits?.[auditId]?.numericValue;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? Number.NaN;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export type RouteMetricMedians = {
  readonly lcpMs: number;
  readonly tbtMs: number;
  readonly ttiMs: number;
  readonly speedIndexMs: number;
  readonly totalByteWeightKb: number;
  readonly cls: number;
};

export function mediansFromLhrs(lhrs: readonly LhrLike[]): RouteMetricMedians {
  const pick = (id: string): number[] =>
    lhrs.map((l) => metricValue(l, id)).filter((n): n is number => n !== null);

  return {
    lcpMs: median(pick('largest-contentful-paint')),
    tbtMs: median(pick('total-blocking-time')),
    ttiMs: median(pick('interactive')),
    speedIndexMs: median(pick('speed-index')),
    totalByteWeightKb: median(pick('total-byte-weight')) / 1024,
    cls: median(pick('cumulative-layout-shift')),
  };
}

export function assertRouteMetrics(args: {
  readonly routeId: string;
  readonly path: string;
  readonly medians: RouteMetricMedians;
  readonly budget: LighthouseRouteMetrics;
}): string[] {
  const overs: string[] = [];
  const checks: [
    keyof RouteMetricMedians,
    keyof LighthouseRouteMetrics,
    string,
  ][] = [
    ['lcpMs', 'lcpMs', 'LCP'],
    ['tbtMs', 'tbtMs', 'TBT'],
    ['ttiMs', 'ttiMs', 'TTI'],
    ['speedIndexMs', 'speedIndexMs', 'Speed Index'],
    ['totalByteWeightKb', 'totalByteWeightKb', 'total-byte-weight'],
    ['cls', 'cls', 'CLS'],
  ];
  const metricKey = args.routeId === 'shell' ? 'shell' : 'default';
  for (const [medKey, budKey, label] of checks) {
    const actual = args.medians[medKey];
    const limit = args.budget[budKey];
    if (!Number.isFinite(actual)) continue;
    if (actual > limit) {
      overs.push(
        `route ${args.path} (${args.routeId}) median ${label} ${actual.toFixed(1)} > lighthouse.metrics.${metricKey}.${budKey} ${String(limit)}`
      );
    }
  }
  return overs;
}

/** True when `url` matches a banned pattern as a path segment / extension. */
export function urlMatchesBannedPattern(url: string, pattern: string): boolean {
  const norm = url.toLowerCase();
  const p = pattern.toLowerCase();
  if (p.startsWith('.') && !p.includes('/')) {
    return norm.includes(p);
  }
  if (p.includes('/') || p.includes('.')) {
    return norm.includes(p);
  }
  // Word-ish segment: `/pattern`, `-pattern-`, `pattern.`, or ends with pattern
  const re = new RegExp(
    `(?:^|[/._-])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[/._-]|$)`,
    'i'
  );
  return re.test(norm);
}

/**
 * Banned URLs that started at or before first paint (LCP), approximating
 * "before first interaction" on a cold load without a synthetic click.
 */
export function findBannedFetches(args: {
  readonly lhr: LhrLike;
  readonly patterns: readonly string[];
}): string[] {
  const lcp = metricValue(args.lhr, 'largest-contentful-paint');
  const cutoffMs =
    lcp !== null && Number.isFinite(lcp) ? lcp : Number.POSITIVE_INFINITY;
  const items = args.lhr.audits?.['network-requests']?.details?.items ?? [];
  const hits: string[] = [];
  for (const item of items) {
    const url = item.url ?? '';
    if (url.length === 0) continue;
    const start =
      item.networkRequestTime ?? item.startTime ?? item.rendererStartTime;
    // Missing timing → skip (do not treat as pre-LCP).
    if (typeof start !== 'number' || !Number.isFinite(start)) continue;
    if (start > cutoffMs) continue;
    for (const p of args.patterns) {
      if (urlMatchesBannedPattern(url, p)) {
        hits.push(url);
        break;
      }
    }
  }
  return hits;
}
