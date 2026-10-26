import { metrics } from '@opentelemetry/api';
import { ATTR } from './attributes';

export const METRIC_DIMENSION_KEYS = [
  ATTR.DEPLOYMENT_ENVIRONMENT_NAME,
  'telemetry.outcome',
  'app.outcome',
  'http.request.method',
  'app.http.status_class',
  'app.http.route_group',
  'app.mutation.outcome',
  'error.type',
  'game.mode',
  'app.room.module',
  'app.room.outcome',
  'web_vital.name',
  'app.synthetic.check',
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
  /**
   * A gauge is one reading per sample (a probe's 1 or 0), read by counting
   * and summing its samples over a window rather than by `increase`.
   */
  readonly type: 'counter' | 'histogram' | 'gauge';
  /** Finite vocabularies only; identifiers can never become metric labels. */
  readonly dimensions: Readonly<Record<string, readonly string[]>>;
  /**
   * Stamp every point with the runtime's `deployment.environment.name`, so an
   * alert selects the environment on the series itself. A Worker isolate's
   * resource information goes stale shortly after the isolate ends, so a
   * resource join loses whatever an ended isolate counted.
   */
  readonly environmentScoped?: boolean;
};

const DIMENSION_VALUE = /^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,63}$/;
let metricEnvironment = 'local';

/**
 * The environment `environmentScoped` metrics report. The telemetry runtime
 * that installs the global meter provider sets it once; a name a label cannot
 * carry reports as `unknown` rather than failing the runtime's boot.
 */
export function setMetricEnvironment(environment: string): void {
  metricEnvironment = DIMENSION_VALUE.test(environment)
    ? environment
    : 'unknown';
}

export function createMetric(contract: MetricContract) {
  for (const [key, values] of Object.entries(contract.dimensions)) {
    if (
      !METRIC_DIMENSION_KEYS.includes(
        key as (typeof METRIC_DIMENSION_KEYS)[number]
      ) ||
      values.some((value) => !DIMENSION_VALUE.test(value)) ||
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
      : contract.type === 'gauge'
        ? meter.createGauge(contract.name, contract)
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
    const stamped =
      contract.environmentScoped === true
        ? {
            ...attributes,
            [ATTR.DEPLOYMENT_ENVIRONMENT_NAME]: metricEnvironment,
          }
        : attributes;
    try {
      if ('add' in instrument) instrument.add(value, stamped);
      else instrument.record(value, stamped);
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
