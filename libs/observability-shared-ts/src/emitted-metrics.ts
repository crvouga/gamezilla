import {
  SYNC_DURATION_METRIC,
  SYNC_STARTED_METRIC,
  SYNC_TARGET_METRIC,
} from '@pkgs/observability-root-shared-ts/metric-contract';
/**
 * Every metric the server emits, as its contract, and the series names a
 * Prometheus-compatible backend stores for it. Dashboards, alert rules and
 * objectives name metrics only through this catalog (or are checked against
 * it), so a rename in the code that emits breaks a test here rather than
 * silently emptying a graph.
 */

import { BILLING_CALLBACKS_METRIC } from '@pkgs/observability-root-shared-ts/billing-metrics';
import { httpMetricContracts } from '@pkgs/observability-root-shared-ts/http-metrics';
import type { MetricContract } from '@pkgs/observability-root-shared-ts/metric-contract';
import { MUTATION_REPLAYS_METRIC } from '@pkgs/observability-root-shared-ts/mutation-metrics';
import {
  OUTBOX_DELIVERIES_EXHAUSTED_METRIC,
  OUTBOX_DRAIN_RUNS_METRIC,
  OUTBOX_READY_AGE_METRIC,
} from '@pkgs/observability-root-shared-ts/outbox-metrics';
import {
  EXPORT_ATTEMPTS_METRIC,
  pipelineHeartbeatContract,
  SCHEMA_VIOLATIONS_METRIC,
} from '@pkgs/observability-root-shared-ts/pipeline-metrics';
import type { PrometheusSeries } from '@pkgs/observability-root-shared-ts/prometheus-names';
import {
  escapePrometheusName,
  prometheusSeries,
} from '@pkgs/observability-root-shared-ts/prometheus-names';
import { ROUTE_GROUPS } from './route-groups';
import { SYNTHETIC_CHECK_METRIC } from './synthetic-checks';
import {
  PROBE_CERT_EXPIRY_METRIC,
  PROBE_DURATION_METRIC,
  PROBE_SUCCESS_METRIC,
} from './synthetic-monitoring';

/**
 * How a metric's points say which environment they belong to.
 *
 * - `label`: on each point. Grafana Cloud copies the resource's
 *   `deployment.environment.name` onto every point it ingests over OTLP, so
 *   a query never joins `target_info`, which only the isolates still running
 *   carry and so loses everything an ended isolate counted.
 * - `job-suffix`: in the job name (`api-ready-prd`), for Synthetic
 *   Monitoring, whose own labels are not on every tenant's points.
 */
export type EnvironmentPlacement =
  | { readonly kind: 'label'; readonly label: string }
  | { readonly kind: 'job-suffix' };

const ON_THE_POINT: EnvironmentPlacement = {
  kind: 'label',
  label: 'deployment_environment_name',
};
const IN_THE_JOB: EnvironmentPlacement = { kind: 'job-suffix' };

export type EmittedMetric = {
  readonly contract: MetricContract;
  /** The names a Prometheus-compatible backend stores. */
  readonly series: PrometheusSeries;
  /**
   * Dimensions whose values are not a fixed list (the environment a beat
   * names). A matcher may select any value of these.
   */
  readonly openDimensions: readonly string[];
  readonly environment: EnvironmentPlacement;
};

const http = httpMetricContracts(ROUTE_GROUPS);
const heartbeat = pipelineHeartbeatContract('');

function emitted(
  contract: MetricContract,
  openDimensions: readonly string[] = [],
  environment: EnvironmentPlacement = ON_THE_POINT
): EmittedMetric {
  return {
    contract,
    series: prometheusSeries(contract),
    openDimensions,
    environment,
  };
}

export const EMITTED_METRICS: readonly EmittedMetric[] = [
  ...[SYNC_DURATION_METRIC, SYNC_STARTED_METRIC, SYNC_TARGET_METRIC].map(
    (contract) => emitted(contract)
  ),
  emitted(http.requests),
  emitted(http.duration),
  emitted(MUTATION_REPLAYS_METRIC),
  emitted(heartbeat, Object.keys(heartbeat.dimensions)),
  emitted(EXPORT_ATTEMPTS_METRIC),
  emitted(SCHEMA_VIOLATIONS_METRIC),
  emitted(OUTBOX_DELIVERIES_EXHAUSTED_METRIC),
  emitted(OUTBOX_DRAIN_RUNS_METRIC),
  emitted(OUTBOX_READY_AGE_METRIC),
  emitted(BILLING_CALLBACKS_METRIC),
  emitted(SYNTHETIC_CHECK_METRIC),
  // Written by Grafana Synthetic Monitoring, not the app. The job carries
  // the environment, so its values are open.
  emitted(PROBE_SUCCESS_METRIC, ['job'], IN_THE_JOB),
  emitted(PROBE_DURATION_METRIC, ['job'], IN_THE_JOB),
  emitted(PROBE_CERT_EXPIRY_METRIC, ['job'], IN_THE_JOB),
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
  return new Set(EMITTED_METRICS.flatMap((m) => seriesNamesOf(m)));
}

/** The names the backend stores for one metric. */
export function seriesNamesOf(metric: EmittedMetric): readonly string[] {
  const { series } = metric;
  if (series.kind === 'counter') return [series.total];
  if (series.kind === 'gauge') return [series.value];
  return [series.bucket, series.sum, series.count];
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
    ...(metric.environment.kind === 'label' ? [metric.environment.label] : []),
    ...IDENTITY_LABELS,
  ]);
}
