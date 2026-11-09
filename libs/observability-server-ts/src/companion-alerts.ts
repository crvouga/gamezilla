/**
 * Rules that accompany the objectives' burn rates, generated from the same
 * objective files and indicator catalog. OpenSLO's alert conditions are
 * burn rates only, so these are documented companions
 * (`libs/observability-server-ts/README.md`, "Service level objectives"):
 *
 * - **low traffic**: while too few events arrive for a burn rate, the bad
 *   ones are counted instead, so a person meeting a failure is never
 *   waiting for traffic to grow;
 * - **certificates**: the certificate the checks are shown, before it
 *   expires.
 */

import type { OpenSloDoc } from '@pkgs/openslo-shared-ts/model';
import {
  ENVIRONMENT_PLACEHOLDER,
  exploreLookback,
  logsPath,
  tracesPath,
} from './alert-links';
import type { AlertRule } from './alert-rule';
import { ruleKey } from './alert-rule';
import { emittedMetric } from './emitted-metrics';
import {
  investigationCommand,
  metricBackedSlos,
  metricIndicatorOf,
  README_URL,
  routeOf,
  runbookFor,
  tierOf,
} from './slo-alerts';
import {
  badCount,
  scopeClauses,
  sliceLabel,
  windowQueries,
} from './slo-promql';
import { PROBE_CERT_EXPIRY_METRIC, PROBE_CHECKS } from './synthetic-monitoring';

/** What every rule about one objective (or none) leaves out of the generic shape. */
function blank(): Pick<
  AlertRule,
  | 'slo'
  | 'covers'
  | 'slice_label'
  | 'budget_spent'
  | 'burn_threshold'
  | 'budget_expr'
> {
  return {
    slo: '',
    covers: '',
    slice_label: '',
    budget_spent: '',
    burn_threshold: 0,
    budget_expr: '',
  };
}

/**
 * Absolute bad-event counts notify at any traffic volume. Each slice is
 * judged independently, alongside the ratio-based burn policies.
 */
export function failureCountRules(
  docs: readonly OpenSloDoc[]
): readonly AlertRule[] {
  return metricBackedSlos(docs).flatMap((slo): AlertRule[] => {
    const indicator = metricIndicatorOf(slo);
    const count = indicator.failureCounts;
    if (count === undefined) return [];
    const by = sliceLabel(indicator);
    const queries = (split: string | null) =>
      windowQueries({
        indicator,
        window: count.window,
        environment: ENVIRONMENT_PLACEHOLDER,
        by: split,
      });
    const name = slo.displayName ?? slo.name;
    const lookback = exploreLookback(count.window);
    return (
      [
        ['push', count.push, 'warning'],
        ['page', count.page, 'critical'],
      ] as const
    ).map(([level, threshold, severity]) => ({
      ...blank(),
      key: ruleKey(`failure-count:${slo.name}:${level}`),
      name: `${name}: ${String(threshold)} or more bad in ${count.window} (${level})`,
      expr: `(${badCount(queries(by))} >= ${String(threshold)})`,
      for: '0s',
      severity,
      owner: indicator.owner,
      tier: String(tierOf(slo)),
      route: routeOf(severity, tierOf(slo)),
      capability: slo.service,
      covers: slo.name,
      slice_label: by ?? '',
      summary: `${String(threshold)} or more of the events ${name} is judged by were bad in the last ${count.window}. This count alerts independently of traffic volume; a healthy majority cannot hide an individual failure.`,
      runbook_url: runbookFor(slo.name),
      investigate_command: investigationCommand({
        indicator,
        lookback: count.window,
      }),
      logs_path: logsPath(lookback),
      traces_path: tracesPath(lookback),
    }));
  });
}

const DAY_SECONDS = 86_400;

/**
 * The certificate the checks are shown, before it expires: a push two
 * weeks out, a page three days out. An expired certificate is an outage for
 * everyone, and nothing else would see it coming.
 */
export function certificateRules(): readonly AlertRule[] {
  const metric = emittedMetric(PROBE_CERT_EXPIRY_METRIC.name);
  if (metric.series.kind !== 'gauge')
    throw new Error('observability: certificate expiry is not a gauge');
  const selector = `${metric.series.value}{${scopeClauses({
    metric,
    scope: [{ dimension: 'job', op: 'is', values: PROBE_CHECKS }],
    environment: ENVIRONMENT_PLACEHOLDER,
  }).join(',')}}`;
  return (
    [
      [14, 'warning', 'push'],
      [3, 'critical', 'page'],
    ] as const
  ).map(([days, severity, route]) => ({
    ...blank(),
    key: ruleKey(`certificate:${String(days)}d`),
    name: `A certificate people are shown expires within ${String(days)} days`,
    expr: `((min by (job)(${selector}) - time()) < bool ${String(days * DAY_SECONDS)})`,
    for: '15m',
    severity,
    owner: 'runtime',
    tier: '0',
    route,
    capability: 'runtime',
    slice_label: 'job',
    summary: `The TLS certificate Synthetic Monitoring was shown expires within ${String(days)} days. Once it expires nobody can open the app. Certificates are issued by Cloudflare for the edge hosts and by AWS for the broker; check that renewal is not blocked (DNS validation, a paused zone).`,
    runbook_url: `${README_URL.split('#')[0] ?? ''}#a-certificate-people-are-shown-expires`,
    investigate_command: 'bun obs last --window 1h --source prod',
    logs_path: logsPath('1h'),
    traces_path: tracesPath('1h'),
  }));
}
