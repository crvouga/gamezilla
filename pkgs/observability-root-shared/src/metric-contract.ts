import { metrics } from '@opentelemetry/api';
import { ATTR } from './attributes';

export const METRIC_DIMENSION_KEYS = [
  ATTR.DEPLOYMENT_ENVIRONMENT_NAME,
  'telemetry.outcome',
  'http.request.method',
  'app.http.status_class',
  'app.http.route_group',
  'app.mutation.outcome',
  'error.type',
  'game.mode',
  'app.room.module',
  'app.room.outcome',
  'web_vital.name',
] as const;

/**
 * Where the SDK cuts every histogram, in the instrument's own unit (seconds
 * for durations). A latency objective can only count "at most X" when X is
 * one of these, so the runtime and the objectives read the same list.
 */
export const HISTOGRAM_BOUNDARIES: readonly number[] = [
  0, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
  25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000,
];

/** The most label combinations one instrument may produce. */
export const SERIES_BUDGET = 256;

export type MetricContract = {
  readonly name: string;
  readonly description: string;
  readonly unit: string;
  readonly type: 'counter' | 'histogram';
  /** Finite vocabularies only; identifiers can never become metric labels. */
  readonly dimensions: Readonly<Record<string, readonly string[]>>;
};

export function createMetric(contract: MetricContract) {
  for (const [key, values] of Object.entries(contract.dimensions)) {
    if (
      !METRIC_DIMENSION_KEYS.includes(
        key as (typeof METRIC_DIMENSION_KEYS)[number]
      ) ||
      values.some(
        (value) => !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,63}$/.test(value)
      ) ||
      new Set(values).size !== values.length
    )
      throw new Error(
        'Metric dimensions require an approved finite vocabulary'
      );
  }
  const combinations = Object.values(contract.dimensions).reduce(
    (total, values) => total * values.length,
    1
  );
  if (combinations < 1 || combinations > SERIES_BUDGET)
    throw new Error('Metric dimensions exceed the series budget');
  const meter = metrics.getMeter('@pkgs/observability');
  const instrument =
    contract.type === 'counter'
      ? meter.createCounter(contract.name, contract)
      : meter.createHistogram(contract.name, contract);
  return (
    value: number,
    attributes: Readonly<Record<string, string>>
  ): boolean => {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      !validDimensions(contract, attributes)
    )
      return false;
    try {
      if ('add' in instrument) instrument.add(value, attributes);
      else instrument.record(value, attributes);
      return true;
    } catch {
      return false;
    }
  };
}

function validDimensions(
  contract: MetricContract,
  attributes: Readonly<Record<string, string>>
): boolean {
  return (
    Object.keys(attributes).length ===
      Object.keys(contract.dimensions).length &&
    Object.entries(attributes).every(
      ([key, value]) => contract.dimensions[key]?.includes(value) === true
    )
  );
}
