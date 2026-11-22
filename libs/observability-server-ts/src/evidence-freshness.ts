/**
 * Alerts when evidence the team schedules stops arriving. An objective whose
 * indicator declares `evidence: 'schedule'` is judged from the team's own
 * checks or the server's scheduled work, which run whether anyone uses the
 * app or not. When they stop (the Health workflow is out of Actions minutes,
 * Synthetic Monitoring's checks were removed, the drain's cron stopped,
 * telemetry export broke), every objective they feed goes quiet instead of
 * failing, and no alert would no longer mean the app works. Each source
 * below pushes and then pages once it has been quiet for longer than its
 * schedule allows.
 *
 * People's own requests are never watched for silence (#358): with few
 * people, quiet is expected. Only production is watched, because only
 * production notifies and other environments run their checks on slower,
 * irregular schedules.
 *
 * A sliced source names each slice (check, probe) that stopped while the
 * others still report. A slice counts only once it has reported in the last
 * `SEEN_WITHIN`, so a check an environment never runs is not silence; a
 * source with nothing at all in its window fires on its own.
 */

import { technicalName } from '@libs/product-identity-shared-ts/technical-names';
import { OUTBOX_DRAIN_RUNS_METRIC } from '@pkgs/observability-root-shared-ts/outbox-metrics';
import type { OpenSloDoc } from '@pkgs/openslo-shared-ts/model';
import { ENVIRONMENT_PLACEHOLDER, logsPath, tracesPath } from './alert-links';
import type { AlertRule } from './alert-rule';
import { ruleKey } from './alert-rule';
import { emittedMetric, labelOf } from './emitted-metrics';
import {
  metricBackedSlos,
  metricIndicatorOf,
  REPOSITORY_URL,
  routeOf,
} from './slo-alerts';
import type { Matcher, MetricIndicator } from './slo-indicators';
import { metricIndicators } from './slo-indicators';
import { scopeClauses } from './slo-promql';
import {
  SYNTHETIC_CHECK_DIMENSION,
  SYNTHETIC_CHECK_METRIC,
} from './synthetic-checks';
import {
  PROBE_DURATION_METRIC,
  PROBE_SUCCESS_METRIC,
} from './synthetic-monitoring';

/** How far back a slice must have reported to be expected now. */
const SEEN_WITHIN = '3d';

const RUNBOOK = `${REPOSITORY_URL}/libs/observability-server-ts/README.md#the-teams-evidence-has-gone-quiet`;

/** One stream of scheduled evidence and how long it may be quiet. */
export type EvidenceSource = {
  readonly key: string;
  /** What produces it, in a sentence's subject. */
  readonly what: string;
  /** The metric the rule reads. */
  readonly metric: string;
  /** Other metrics the same runs write, whose indicators it also covers. */
  readonly alsoWrites: readonly string[];
  readonly scope: readonly Matcher[];
  /** The dimension each slice is named by, or `null` for one stream. */
  readonly sliceBy: string | null;
  /** Quiet this long pushes. */
  readonly push: string;
  /** Quiet this long pages. */
  readonly page: string;
  readonly owner: string;
  /** Where to look first, after the runbook. */
  readonly firstLook: string;
  readonly investigate: string;
};

const job = (values: readonly string[]): readonly Matcher[] => [
  { dimension: 'job', op: 'is', values },
];

export const EVIDENCE_SOURCES: readonly EvidenceSource[] = [
  {
    key: 'health-checks',
    what: "The Health workflow's checks of every live feature",
    metric: SYNTHETIC_CHECK_METRIC.name,
    alsoWrites: [],
    scope: [],
    sliceBy: SYNTHETIC_CHECK_DIMENSION,
    // Scheduled hourly; GitHub delays and drops schedules, and a check
    // yields to a deploy under way, so a few missed hours are routine.
    push: '6h',
    page: '12h',
    owner: 'runtime',
    firstLook:
      "the Health workflow's latest runs on main (`gh run list --workflow health.yml --branch main`): an Actions budget, a disabled schedule, a run that never reached its record step",
    investigate: 'bun obs last --window 12h --source prod',
  },
  {
    key: 'opening-probes',
    what: "Synthetic Monitoring's minute checks of the app shell and API",
    metric: PROBE_SUCCESS_METRIC.name,
    alsoWrites: [PROBE_DURATION_METRIC.name],
    scope: job(['app-shell', 'api-ready']),
    sliceBy: 'job',
    push: '10m',
    page: '20m',
    owner: 'runtime',
    firstLook:
      'the checks in Grafana Synthetic Monitoring (removed, disabled, or the probe location down) and the latest foundation apply',
    investigate: 'bun obs last --window 1h --source prod',
  },
  {
    key: 'broker-probe',
    what: "Synthetic Monitoring's ten-minute check of the live-updates broker",
    metric: PROBE_SUCCESS_METRIC.name,
    alsoWrites: [],
    scope: job(['broker']),
    sliceBy: null,
    push: '40m',
    page: '90m',
    owner: 'runtime',
    firstLook:
      'the broker check in Grafana Synthetic Monitoring and the latest foundation apply',
    investigate: 'bun obs last --window 2h --source prod',
  },
  {
    key: 'background-drain',
    what: "The server's scheduled background work (the outbox drain, every minute)",
    metric: OUTBOX_DRAIN_RUNS_METRIC.name,
    alsoWrites: [],
    scope: [],
    sliceBy: null,
    push: '10m',
    page: '20m',
    owner: 'runtime',
    firstLook:
      "the Worker's cron trigger and its recent invocations in Cloudflare, then whether telemetry export works at all (OBSERVABILITY_ENABLED, the collector token)",
    investigate: `bun obs platform --service ${technicalName(['prod'])} --window 1h`,
  },
];

/** The series a source's rule selects, scoped to one environment. */
function selectorOf(source: EvidenceSource): string {
  const metric = emittedMetric(source.metric);
  const name =
    metric.series.kind === 'counter'
      ? metric.series.total
      : metric.series.kind === 'gauge'
        ? metric.series.value
        : metric.series.count;
  const clauses = scopeClauses({
    metric,
    scope: source.scope,
    environment: ENVIRONMENT_PLACEHOLDER,
  });
  return `${name}{${clauses.join(',')}}`;
}

/** Positive while the source (or one of its slices) has been quiet for `window`. */
export function quietExpression(
  source: EvidenceSource,
  window: string
): string {
  const picked = selectorOf(source);
  const nothing = `absent_over_time(${picked}[${window}])`;
  if (source.sliceBy === null) return nothing;
  const by = labelOf(source.sliceBy);
  const seen = (range: string) =>
    `count by (${by})(count_over_time(${picked}[${range}]))`;
  return `((${seen(SEEN_WITHIN)} unless ${seen(window)}) or ${nothing})`;
}

/** Whether `source` carries the events `indicator` is judged by. */
export function sourceCovers(
  source: EvidenceSource,
  indicator: MetricIndicator
): boolean {
  if (![source.metric, ...source.alsoWrites].includes(indicator.metric))
    return false;
  const jobs = source.scope.find((m) => m.dimension === 'job');
  if (jobs === undefined) return true;
  const wanted = indicator.scope.find((m) => m.dimension === 'job');
  return (
    wanted !== undefined &&
    wanted.values.every((value) => jobs.values.includes(value))
  );
}

/**
 * Every indicator whose evidence is the team's schedule must be watched by
 * a source, and no source may watch people's traffic: either mistake
 * breaks "no alert means the promise is kept".
 */
export function freshnessIssues(): readonly string[] {
  const issues: string[] = [];
  for (const indicator of metricIndicators()) {
    const covered = EVIDENCE_SOURCES.some((source) =>
      sourceCovers(source, indicator)
    );
    if (indicator.evidence === 'schedule' && !covered) {
      issues.push(
        `${indicator.sli}: its evidence is scheduled but no source in EVIDENCE_SOURCES (libs/observability-server-ts/src/evidence-freshness.ts) alerts when it stops`
      );
    }
    if (indicator.evidence === 'people' && covered) {
      issues.push(
        `${indicator.sli}: its evidence comes from people, whose silence is expected, yet an evidence source watches it for silence`
      );
    }
  }
  return issues;
}

/** Push, then page, when each source stops reporting in production. */
export function evidenceFreshnessRules(
  docs: readonly OpenSloDoc[]
): readonly AlertRule[] {
  return EVIDENCE_SOURCES.flatMap((source): AlertRule[] => {
    const covers = metricBackedSlos(docs)
      .filter((slo) => sourceCovers(source, metricIndicatorOf(slo)))
      .map((slo) => slo.name);
    return (
      [
        [source.push, 'warning'],
        [source.page, 'critical'],
      ] as const
    ).map(([window, severity]) => ({
      key: ruleKey(`evidence-quiet:${source.key}:${severity}`),
      name: `Evidence quiet for ${window}: ${source.what}`,
      expr: quietExpression(source, window),
      for: '2m',
      severity,
      owner: source.owner,
      slo: '',
      // The objectives it carries are tier 0; without it they are unjudged.
      tier: '0',
      route: routeOf(severity, 0),
      capability: 'evidence',
      covers: covers.join(','),
      slice_label: source.sliceBy === null ? '' : labelOf(source.sliceBy),
      summary: `${source.what}: nothing reported in production for ${window}, so ${covers.length === 0 ? 'the objectives they feed are' : `${covers.join(', ')} are`} no longer judged: the app may be failing with no alert. Check ${source.firstLook}.`,
      runbook_url: RUNBOOK,
      investigate_command: source.investigate,
      logs_path: logsPath('1h'),
      traces_path: tracesPath('1h'),
      budget_spent: '',
      burn_threshold: 0,
      budget_expr: '',
      production_only: true,
    }));
  });
}
