/**
 * Grafana Synthetic Monitoring's checks of the app, as the metrics backend
 * stores them. The checks are declared in OpenTofu
 * (`libs/infra-shared-ts/tofu/modules/synthetic-monitoring`); this names the
 * same jobs so an objective and the check that feeds it cannot drift apart.
 *
 * Every Synthetic Monitoring metric carries `job`, `instance`, `probe` and
 * `config_version`. A check's own labels reach its metrics only on tenants
 * Grafana has migrated (before that, only `sm_check_info` carries them, as
 * `label_<name>`), so the environment is never read from a label: each
 * check's job is `<check>-<environment>` (`api-ready-prd`).
 *
 * Each run writes one sample of each gauge per check and probe (the reduced
 * "basic" metric set, which includes all three below).
 */

import type { MetricContract } from '@pkgs/observability-root-shared-ts/metric-contract';

/** What each check reaches, without its environment suffix. */
export const PROBE_CHECKS = ['app-shell', 'api-ready', 'broker'] as const;

export type ProbeCheck = (typeof PROBE_CHECKS)[number];

/** The `job` a check runs under in `environment`. */
export function probeJob(check: ProbeCheck, environment: string): string {
  return `${check}-${environment}`;
}

/** 1 when the probe reached its target and every assertion held, 0 otherwise. */
export const PROBE_SUCCESS_METRIC: MetricContract = {
  name: 'probe_success',
  description:
    'Synthetic Monitoring: 1 when a probe reached its target and every assertion held, 0 otherwise',
  type: 'gauge',
  unit: '{result}',
  dimensions: { job: PROBE_CHECKS },
};

/** How long the whole probe took: DNS, connect, TLS, the request and the answer. */
export const PROBE_DURATION_METRIC: MetricContract = {
  name: 'probe_duration_seconds',
  description:
    'Synthetic Monitoring: how long one probe took, from DNS lookup to the last byte',
  type: 'gauge',
  unit: 's',
  dimensions: { job: PROBE_CHECKS },
};

/** When the first certificate in the probed chain expires, in Unix seconds. */
export const PROBE_CERT_EXPIRY_METRIC: MetricContract = {
  name: 'probe_ssl_earliest_cert_expiry',
  description:
    'Synthetic Monitoring: when the earliest certificate the probe was shown expires (Unix seconds)',
  type: 'gauge',
  unit: '',
  dimensions: { job: PROBE_CHECKS },
};

/** Seconds between two runs of each check in production, per probe. */
export const PROBE_EVERY_SECONDS: Readonly<Record<ProbeCheck, number>> = {
  'app-shell': 60,
  'api-ready': 60,
  broker: 600,
};
