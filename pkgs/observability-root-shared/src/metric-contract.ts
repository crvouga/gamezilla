import { metrics } from '@opentelemetry/api';

export const METRIC_DIMENSION_KEYS = [
  'http.request.method',
  'app.http.status_class',
  'error.type',
  'game.mode',
  'app.room.module',
  'app.room.outcome',
  'web_vital.name',
] as const;

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
  if (combinations < 1 || combinations > 256)
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
