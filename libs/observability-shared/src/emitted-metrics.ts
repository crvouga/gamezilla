/**
 * Every metric the server emits, as its contract, and the series names a
 * Prometheus-compatible backend stores for it. Dashboards, alert rules and
 * objectives name metrics only through this catalog (or are checked against
 * it), so a rename in the code that emits breaks a test here rather than
 * silently emptying a graph.
 */

import { httpMetricContracts } from '@pkgs/observability-root-shared/http-metrics';
import type { MetricContract } from '@pkgs/observability-root-shared/metric-contract';
import { MUTATION_REPLAYS_METRIC } from '@pkgs/observability-root-shared/mutation-metrics';
import {
  EXPORT_ATTEMPTS_METRIC,
  pipelineHeartbeatContract,
  SCHEMA_VIOLATIONS_METRIC,
} from '@pkgs/observability-root-shared/pipeline-metrics';
import type { PrometheusSeries } from '@pkgs/observability-root-shared/prometheus-names';
import {
  escapePrometheusName,
  prometheusSeries,
} from '@pkgs/observability-root-shared/prometheus-names';
import { ROUTE_GROUPS } from './route-groups';

export type EmittedMetric = {
  readonly contract: MetricContract;
  /** The names a Prometheus-compatible backend stores. */
  readonly series: PrometheusSeries;
  /**
   * Dimensions whose values are not a fixed list (the environment a beat
   * names). A matcher may select any value of these.
   */
  readonly openDimensions: readonly string[];
};

const http = httpMetricContracts(ROUTE_GROUPS);
const heartbeat = pipelineHeartbeatContract('');

function emitted(
  contract: MetricContract,
  openDimensions: readonly string[] = []
): EmittedMetric {
  return { contract, series: prometheusSeries(contract), openDimensions };
}

export const EMITTED_METRICS: readonly EmittedMetric[] = [
  emitted(http.requests),
  emitted(http.duration),
  emitted(MUTATION_REPLAYS_METRIC),
  emitted(heartbeat, Object.keys(heartbeat.dimensions)),
  emitted(EXPORT_ATTEMPTS_METRIC),
  emitted(SCHEMA_VIOLATIONS_METRIC),
];

export function emittedMetric(name: string): EmittedMetric {
  const found = EMITTED_METRICS.find((m) => m.contract.name === name);
  if (found === undefined) {
    throw new Error(
      `observability: no emitted metric named ${name} (${EMITTED_METRICS.map((m) => m.contract.name).join(', ')})`
    );
  }
  return found;
}

/** Every series name the backend stores for the metrics above. */
export function emittedSeriesNames(): ReadonlySet<string> {
  return new Set(
    EMITTED_METRICS.flatMap((m) =>
      m.series.kind === 'counter'
        ? [m.series.total]
        : [m.series.bucket, m.series.sum, m.series.count]
    )
  );
}

/** The label a dimension becomes (`app.http.route_group` → `app_http_route_group`). */
export function labelOf(dimension: string): string {
  return escapePrometheusName(dimension);
}

/**
 * Labels any series carries beyond its dimensions: the histogram bucket
 * bound, and the scrape identity the backend adds from the resource.
 */
export const IDENTITY_LABELS: readonly string[] = ['le', 'job', 'instance'];

/** Every label name some emitted series can be selected by. */
export function labelsOf(metric: EmittedMetric): ReadonlySet<string> {
  return new Set([
    ...Object.keys(metric.contract.dimensions).map(labelOf),
    ...IDENTITY_LABELS,
  ]);
}
