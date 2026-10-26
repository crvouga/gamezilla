/**
 * Rules that accompany the objectives' burn rates, generated from the same
 * objective files and indicator catalog. OpenSLO's alert conditions are
 * burn rates only, so these are documented companions
 * (`libs/observability-shared-ts/README.md`, "Service level objectives"):
 *
 * - **silence**: one per source of events behind the tier 0 and 1
 *   objectives, so no traffic or no checks can never look perfect;
 * - **low traffic**: while too few events arrive for a burn rate, the bad
 *   ones are counted instead, so a person meeting a failure is never
 *   waiting for traffic to grow;
 * - **certificates**: the certificate the checks are shown, before it
 *   expires.
 */

import type { OpenSloDoc, Slo } from '@pkgs/openslo-shared-ts/model';
import { parseDuration } from '@pkgs/openslo-shared-ts/window';
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
import type { Matcher, MetricIndicator } from './slo-indicators';
import {
  badCount,
  numberText,
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
 * The events a group of indicators on one metric count, together: each
 * dimension they all narrow keeps every value any of them selects; one any
 * of them leaves open is left open.
 */
function unionScope(
  indicators: readonly MetricIndicator[]
): readonly Matcher[] {
  const dimensions = [
    ...new Set(indicators.flatMap((i) => i.scope.map((m) => m.dimension))),
  ];
  return dimensions.flatMap((dimension): Matcher[] => {
    const values: string[] = [];
    for (const indicator of indicators) {
      const matcher = indicator.scope.find((m) => m.dimension === dimension);
      if (matcher === undefined || matcher.op !== 'is') return [];
      for (const value of matcher.values)
        if (!values.includes(value)) values.push(value);
    }
    return [{ dimension, op: 'is', values }];
  });
}

/**
 * One rule per source of events behind the tier 0 and 1 objectives (a
 * metric, read at one cadence): it fires when the source counted none of
 * their events for `silence.after`. Objectives counted by the same source
 * share a rule, so one stopped source is one alert; a source sampled less
 * often (the broker check) has its own, so a busier one cannot mask it.
 */
export function silenceRules(
  docs: readonly OpenSloDoc[]
): readonly AlertRule[] {
  const bySource = new Map<
    string,
    { slos: Slo[]; indicators: MetricIndicator[] }
  >();
  for (const slo of metricBackedSlos(docs)) {
    if (tierOf(slo) > 1) continue;
    const indicator = metricIndicatorOf(slo);
    const source = `${indicator.metric} ${indicator.silence.after} ${indicator.silence.severity}`;
    const found = bySource.get(source) ?? { slos: [], indicators: [] };
    found.slos.push(slo);
    if (!found.indicators.includes(indicator)) found.indicators.push(indicator);
    bySource.set(source, found);
  }
  return [...bySource.entries()].map(([source, { slos, indicators }]) => {
    const [first] = slos;
    const [indicator] = indicators;
    if (first === undefined || indicator === undefined)
      throw new Error('a silence source has no SLO');
    const tier = Math.min(...slos.map(tierOf)) as 0 | 1;
    const names = slos.map((slo) => slo.displayName ?? slo.name);
    const { after, severity } = indicator.silence;
    const { total } = windowQueries({
      indicator: { ...indicator, scope: unionScope(indicators) },
      window: after,
      environment: ENVIRONMENT_PLACEHOLDER,
    });
    return {
      ...blank(),
      key: ruleKey(`silence:${source}`),
      name: `No events for ${names.join(', ')} (${after})`,
      // `bool`: the rule fires on a value above zero, never on the count itself.
      expr: `(${total} or vector(0)) < bool 1`,
      for: '5m',
      severity,
      owner: indicator.owner,
      tier: String(tier),
      route: routeOf(severity, tier),
      capability: first.service,
      covers: slos.map((slo) => slo.name).join(', '),
      summary: `Nothing was counted for ${after} that ${names.join(', ')} are judged by, so they cannot be judged and would look perfect. Either what feeds them stopped (people cannot reach the app, the Health workflow or a Synthetic Monitoring check is not running, scheduled work stopped) or telemetry stopped reaching the metrics backend.`,
      runbook_url: runbookFor(first.name),
      investigate_command: `bun obs last --window ${exploreLookback(after)} --source prod`,
      logs_path: logsPath(exploreLookback(after)),
      traces_path: tracesPath(exploreLookback(after)),
    };
  });
}

/**
 * For each objective whose indicator states a `lowTraffic` count: a push
 * rule and a page rule on the number of bad events in the window, slice by
 * slice, active only while the whole window held fewer events than its burn
 * rates need (`minimumEventsPerHour`). Above that the burn rates judge.
 */
export function lowTrafficRules(
  docs: readonly OpenSloDoc[]
): readonly AlertRule[] {
  return metricBackedSlos(docs).flatMap((slo): AlertRule[] => {
    const indicator = metricIndicatorOf(slo);
    const count = indicator.lowTraffic;
    if (count === undefined) return [];
    const by = sliceLabel(indicator);
    const queries = (split: string | null) =>
      windowQueries({
        indicator,
        window: count.window,
        environment: ENVIRONMENT_PLACEHOLDER,
        by: split,
      });
    const hours = (parseDuration(count.window) ?? 0) / 3_600_000;
    const floor = numberText(indicator.minimumEventsPerHour * hours);
    const quiet = `on() (${queries(null).total} < ${floor})`;
    const name = slo.displayName ?? slo.name;
    const lookback = exploreLookback(count.window);
    return (
      [
        ['push', count.push, 'warning'],
        ['page', count.page, 'critical'],
      ] as const
    ).map(([level, threshold, severity]) => ({
      ...blank(),
      key: ruleKey(`low-traffic:${slo.name}:${level}`),
      name: `${name}: ${String(threshold)} or more bad in ${count.window} at low traffic (${level})`,
      expr: `(${badCount(queries(by))} >= ${String(threshold)}) and ${quiet}`,
      for: '1m',
      severity,
      owner: indicator.owner,
      tier: String(tierOf(slo)),
      route: routeOf(severity, tierOf(slo)),
      capability: slo.service,
      covers: slo.name,
      slice_label: by ?? '',
      summary: `${String(threshold)} or more of the events ${name} is judged by were bad in the last ${count.window}, while traffic is too low (under ${floor} events) for its burn rate to judge. Every one is a person who met it.`,
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
