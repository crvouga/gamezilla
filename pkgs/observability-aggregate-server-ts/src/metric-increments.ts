import {
  DataPointType,
  type MetricData,
  type ResourceMetrics,
} from '@opentelemetry/sdk-metrics';

/**
 * What one short-lived writer counted since it last said so: a counter's
 * growth, a histogram's new observations, a gauge's latest reading. Writers
 * hand these to the one aggregate that keeps the running totals, so stored
 * series depend on metric and label combinations, not on how many writers
 * lived.
 */
export type MetricIncrement = {
  readonly scope: string;
  readonly name: string;
  readonly unit: string;
  readonly description: string;
  readonly kind: 'sum' | 'gauge' | 'histogram';
  /** A sum that only grows. Always false for a gauge or histogram. */
  readonly monotonic: boolean;
  /** Histogram bucket upper bounds; empty for a sum or gauge. */
  readonly bounds: readonly number[];
  readonly attributes: Readonly<Record<string, string>>;
  /** Growth of a sum, a gauge's reading, or the sum of a histogram. */
  readonly value: number;
  /** Observations of a histogram; zero for a sum or gauge. */
  readonly count: number;
  /** Observations per histogram bucket (one more than `bounds`). */
  readonly buckets: readonly number[];
};

/**
 * One hand-off. `writer` and `sequence` name it, so the aggregate adds it at
 * most once however often its delivery is retried.
 */
export type MetricBatch = {
  readonly writer: string;
  readonly sequence: number;
  readonly createdAtMs: number;
  readonly service: string;
  readonly increments: readonly MetricIncrement[];
};

export type MetricBatchLimits = {
  readonly services: readonly string[];
  readonly attributeKeys: readonly string[];
  readonly maxIncrements: number;
};

const NAME = /^[\x21-\x7e]{1,128}$/;
const TEXT_LIMIT = 256;
const BOUNDS_LIMIT = 32;
const ATTRIBUTE_LIMIT = 16;

/** The series an increment belongs to within its service. */
export function incrementKey(
  service: string,
  increment: MetricIncrement
): string {
  return JSON.stringify([
    service,
    increment.scope,
    increment.name,
    Object.entries(increment.attributes).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0
    ),
  ]);
}

export function sameShape(a: MetricIncrement, b: MetricIncrement): boolean {
  return (
    a.kind === b.kind &&
    a.monotonic === b.monotonic &&
    a.bounds.length === b.bounds.length &&
    a.bounds.every((bound, index) => bound === b.bounds[index])
  );
}

/**
 * `earlier` followed by `later`. A gauge keeps the later reading. So does a
 * series whose shape changed (new histogram bounds): counts cut at different
 * bounds cannot be added.
 */
export function mergeIncrement(
  earlier: MetricIncrement,
  later: MetricIncrement
): MetricIncrement {
  if (later.kind === 'gauge' || !sameShape(earlier, later)) return later;
  return {
    ...later,
    value: earlier.value + later.value,
    count: earlier.count + later.count,
    buckets: later.buckets.map(
      (count, index) => count + (earlier.buckets[index] ?? 0)
    ),
  };
}

function incrementsOfMetric(
  scope: string,
  metric: MetricData
): readonly MetricIncrement[] {
  const base = {
    scope,
    name: metric.descriptor.name,
    unit: metric.descriptor.unit,
    description: metric.descriptor.description,
  };
  const attributesOf = (attributes: Readonly<Record<string, unknown>>) =>
    Object.fromEntries(
      Object.entries(attributes).flatMap(([key, value]) =>
        value === undefined || value === null ? [] : [[key, String(value)]]
      )
    );
  if (metric.dataPointType === DataPointType.HISTOGRAM) {
    return metric.dataPoints.map((point) => ({
      ...base,
      kind: 'histogram' as const,
      monotonic: false,
      bounds: [...point.value.buckets.boundaries],
      attributes: attributesOf(point.attributes),
      value: point.value.sum ?? 0,
      count: point.value.count,
      buckets: [...point.value.buckets.counts],
    }));
  }
  if (
    metric.dataPointType !== DataPointType.SUM &&
    metric.dataPointType !== DataPointType.GAUGE
  )
    return [];
  const sum = metric.dataPointType === DataPointType.SUM;
  return metric.dataPoints.map((point) => ({
    ...base,
    kind: sum ? ('sum' as const) : ('gauge' as const),
    monotonic: sum && metric.isMonotonic,
    bounds: [],
    attributes: attributesOf(point.attributes),
    value: point.value,
    count: 0,
    buckets: [],
  }));
}

/** A delta collection as increments. Exponential histograms are not carried. */
export function incrementsOf(
  collected: ResourceMetrics
): readonly MetricIncrement[] {
  return collected.scopeMetrics.flatMap((scope) =>
    scope.metrics.flatMap((metric) =>
      incrementsOfMetric(scope.scope.name, metric)
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= TEXT_LIMIT;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCounts(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) && value.length === length && value.every(isCount)
  );
}

function parseAttributes(
  input: unknown,
  allowed: readonly string[]
): Record<string, string> | null {
  if (!isRecord(input)) return null;
  const entries = Object.entries(input);
  if (entries.length > ATTRIBUTE_LIMIT) return null;
  const attributes: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!allowed.includes(key) || !isText(value)) return null;
    attributes[key] = value;
  }
  return attributes;
}

function parseBounds(input: unknown): number[] | null {
  if (!Array.isArray(input) || input.length > BOUNDS_LIMIT) return null;
  const bounds: number[] = [];
  for (const bound of input) {
    if (typeof bound !== 'number' || !Number.isFinite(bound)) return null;
    if (bounds.length > 0 && bound <= bounds[bounds.length - 1]!) return null;
    bounds.push(bound);
  }
  return bounds;
}

/** An increment the aggregate may add, or `null` for anything else. */
export function parseIncrement(
  input: unknown,
  attributeKeys: readonly string[]
): MetricIncrement | null {
  if (!isRecord(input)) return null;
  const { scope, name, unit, description, kind, value } = input;
  const attributes = parseAttributes(input['attributes'], attributeKeys);
  const bounds = parseBounds(input['bounds']);
  if (
    !isText(scope) ||
    typeof name !== 'string' ||
    !NAME.test(name) ||
    !isText(unit) ||
    !isText(description) ||
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    attributes === null ||
    bounds === null
  )
    return null;
  const base = { scope, name, unit, description, attributes, value };
  if (kind === 'histogram') {
    const { count, buckets } = input;
    if (!isCount(count) || !isCounts(buckets, bounds.length + 1)) return null;
    return {
      ...base,
      kind,
      monotonic: false,
      bounds,
      count,
      buckets: [...buckets],
    };
  }
  if (kind !== 'sum' && kind !== 'gauge') return null;
  const monotonic = kind === 'sum' && input['monotonic'] === true;
  if (bounds.length > 0 || (monotonic && value < 0)) return null;
  return { ...base, kind, monotonic, bounds: [], count: 0, buckets: [] };
}

/**
 * A hand-off the aggregate may add. A malformed envelope is `null`; an
 * increment outside the closed vocabulary is left out and counted, so one
 * unknown label cannot cost a writer the rest of what it counted.
 */
export function parseMetricBatch(
  input: unknown,
  limits: MetricBatchLimits
): { readonly batch: MetricBatch; readonly refused: number } | null {
  if (!isRecord(input)) return null;
  const { writer, sequence, createdAtMs, service, increments } = input;
  if (
    typeof writer !== 'string' ||
    !NAME.test(writer) ||
    typeof sequence !== 'number' ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1 ||
    !isCount(createdAtMs) ||
    typeof service !== 'string' ||
    !limits.services.includes(service) ||
    !Array.isArray(increments) ||
    increments.length > limits.maxIncrements
  )
    return null;
  const parsed = increments.flatMap((increment) => {
    const result = parseIncrement(increment, limits.attributeKeys);
    return result === null ? [] : [result];
  });
  return {
    batch: { writer, sequence, createdAtMs, service, increments: parsed },
    refused: increments.length - parsed.length,
  };
}
