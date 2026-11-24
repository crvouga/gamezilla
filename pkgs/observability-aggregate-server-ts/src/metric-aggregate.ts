import { ValueType } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AggregationTemporality,
  DataPointType,
  type MetricData,
  type ResourceMetrics,
} from '@opentelemetry/sdk-metrics';
import {
  incrementKey,
  type MetricIncrement,
  mergeIncrement,
  sameShape,
} from './metric-increments';

/** One series the aggregate holds, in the service that counted it. */
export type AggregateSeries = MetricIncrement & {
  readonly service: string;
  /** When this series last changed (a gauge: when it was read). */
  readonly atMs: number;
  /** When the running total began. Unused while waiting. */
  readonly startMs: number;
};

/**
 * `sent` is what the metrics backend was last told: running totals, each
 * with the time it began. `waiting` is what writers handed over since. The
 * two stay apart so an export that fails, or whose outcome is unknown,
 * changes nothing and the next one states totals at least as large.
 */
export type AggregateTotals = {
  readonly sent: Readonly<Record<string, AggregateSeries>>;
  readonly waiting: Readonly<Record<string, AggregateSeries>>;
  /** When the backend last acknowledged an export. */
  readonly sentAtMs: number | null;
};

export const EMPTY_TOTALS: AggregateTotals = {
  sent: {},
  waiting: {},
  sentAtMs: null,
};

export type AggregateLimits = {
  /** The most label combinations one metric of one service may hold. */
  readonly seriesPerMetric: number;
  /** The most series the aggregate holds in all. */
  readonly series: number;
  /**
   * With no acknowledged export for this long, every total begins again
   * from an explicit zero. A query that counts a series' first value as
   * events (because nothing preceded it in the window) then counts zero,
   * not the lifetime total.
   */
  readonly restartAfterMs: number;
  /** A sent series nobody added to for this long is forgotten. */
  readonly forgetAfterMs: number;
};

export type AggregateIdentity = {
  /** The one `service.instance.id` every exported series carries. */
  readonly instanceId: string;
  readonly environment: string;
};

function metricOf(service: string, series: MetricIncrement): string {
  return JSON.stringify([service, series.scope, series.name]);
}

/**
 * `totals` with `increments` waiting to be sent. An increment that would
 * open a series beyond a limit is left out and counted in `refused`.
 */
export function addIncrements(
  totals: AggregateTotals,
  added: {
    readonly service: string;
    readonly increments: readonly MetricIncrement[];
    readonly nowMs: number;
  },
  limits: AggregateLimits
): { readonly totals: AggregateTotals; readonly refused: number } {
  const waiting = { ...totals.waiting };
  const perMetric = new Map<string, number>();
  const known = new Set([...Object.keys(totals.sent), ...Object.keys(waiting)]);
  for (const key of known) {
    const series = waiting[key] ?? totals.sent[key]!;
    const metric = metricOf(series.service, series);
    perMetric.set(metric, (perMetric.get(metric) ?? 0) + 1);
  }
  let refused = 0;
  for (const increment of added.increments) {
    const key = incrementKey(added.service, increment);
    if (!known.has(key)) {
      const metric = metricOf(added.service, increment);
      const held = perMetric.get(metric) ?? 0;
      if (known.size >= limits.series || held >= limits.seriesPerMetric) {
        refused += 1;
        continue;
      }
      known.add(key);
      perMetric.set(metric, held + 1);
    }
    const earlier = waiting[key];
    waiting[key] = {
      ...(earlier === undefined
        ? increment
        : mergeIncrement(earlier, increment)),
      service: added.service,
      atMs: added.nowMs,
      startMs: 0,
    };
  }
  return { totals: { ...totals, waiting }, refused };
}

function zeroOf(series: AggregateSeries, nowMs: number): AggregateSeries {
  return {
    ...series,
    value: 0,
    count: 0,
    buckets: series.buckets.map(() => 0),
    atMs: nowMs,
    startMs: nowMs,
  };
}

export type AggregateExport = {
  /** What to send: one resource per service, all under one writer identity. */
  readonly payloads: readonly ResourceMetrics[];
  /** The totals once the backend acknowledges `payloads`. */
  readonly acknowledged: AggregateTotals;
};

/**
 * The next export. Every running total is restated so its series stays
 * continuous. A series the backend has not seen in this run of totals is
 * first stated as zero, and what it counted follows in the next export: a
 * backend only sees growth between two samples. A gauge is sent once per
 * reading, at the time it was read.
 */
export function planExport(
  totals: AggregateTotals,
  nowMs: number,
  config: {
    readonly limits: AggregateLimits;
    readonly identity: AggregateIdentity;
  }
): AggregateExport {
  const { limits } = config;
  const restart =
    totals.sentAtMs === null || nowMs - totals.sentAtMs > limits.restartAfterMs;
  const before = restart ? {} : totals.sent;
  const sent: Record<string, AggregateSeries> = {};
  const waiting: Record<string, AggregateSeries> = {};
  const points: AggregateSeries[] = [];
  const keys = new Set([
    ...Object.keys(before),
    ...Object.keys(totals.waiting),
  ]);
  for (const key of keys) {
    const held = before[key];
    const added = totals.waiting[key];
    if (added === undefined) {
      if (held === undefined || nowMs - held.atMs > limits.forgetAfterMs)
        continue;
      sent[key] = held;
      if (held.kind !== 'gauge') points.push(held);
    } else if (added.kind === 'gauge') {
      sent[key] = added;
      points.push(added);
    } else if (held !== undefined && sameShape(held, added)) {
      const total = {
        ...mergeIncrement(held, added),
        service: held.service,
        atMs: nowMs,
        startMs: held.startMs,
      };
      sent[key] = total;
      points.push(total);
    } else {
      const zero = zeroOf(added, nowMs);
      sent[key] = zero;
      waiting[key] = added;
      points.push(zero);
    }
  }
  return {
    payloads: payloadsOf(points, nowMs, config.identity),
    acknowledged: { sent, waiting, sentAtMs: nowMs },
  };
}

function hrTime(ms: number): [number, number] {
  return [Math.floor(ms / 1000), Math.round((ms % 1000) * 1e6)];
}

function metricDataOf(
  points: readonly AggregateSeries[],
  nowMs: number
): MetricData {
  const first = points[0]!;
  const base = {
    descriptor: {
      name: first.name,
      description: first.description,
      unit: first.unit,
      valueType: ValueType.DOUBLE,
    },
    aggregationTemporality: AggregationTemporality.CUMULATIVE,
  };
  if (first.kind === 'histogram') {
    return {
      ...base,
      dataPointType: DataPointType.HISTOGRAM,
      dataPoints: points.map((point) => ({
        startTime: hrTime(point.startMs),
        endTime: hrTime(nowMs),
        attributes: point.attributes,
        value: {
          buckets: {
            boundaries: [...point.bounds],
            counts: [...point.buckets],
          },
          sum: point.value,
          count: point.count,
        },
      })),
    };
  }
  if (first.kind === 'gauge') {
    return {
      ...base,
      dataPointType: DataPointType.GAUGE,
      dataPoints: points.map((point) => ({
        startTime: hrTime(point.atMs),
        endTime: hrTime(point.atMs),
        attributes: point.attributes,
        value: point.value,
      })),
    };
  }
  return {
    ...base,
    dataPointType: DataPointType.SUM,
    isMonotonic: first.monotonic,
    dataPoints: points.map((point) => ({
      startTime: hrTime(point.startMs),
      endTime: hrTime(nowMs),
      attributes: point.attributes,
      value: point.value,
    })),
  };
}

function groupBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string
): readonly (readonly T[])[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  }
  return [...groups.values()];
}

function payloadsOf(
  points: readonly AggregateSeries[],
  nowMs: number,
  identity: AggregateIdentity
): readonly ResourceMetrics[] {
  return groupBy(points, (point) => point.service).map((ofService) => ({
    resource: resourceFromAttributes({
      'service.name': ofService[0]!.service,
      'service.instance.id': identity.instanceId,
      'deployment.environment.name': identity.environment,
    }),
    scopeMetrics: groupBy(ofService, (point) => point.scope).map((ofScope) => ({
      scope: { name: ofScope[0]!.scope },
      // One instrument is one kind; a kind that changed in a rollout is
      // stated apart rather than mistyped.
      metrics: groupBy(ofScope, (point) =>
        JSON.stringify([point.name, point.kind, point.monotonic])
      ).map((ofMetric) => metricDataOf(ofMetric, nowMs)),
    })),
  }));
}
