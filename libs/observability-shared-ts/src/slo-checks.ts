/**
 * The checks that keep objectives, the indicator catalog, the instruments
 * the server emits and the queries built on them in step. Each returns the
 * problems it finds, as sentences that say what to change; none returns
 * anything when all is well. Tests run them over the real files, so drift is
 * a failed build instead of an empty graph in production.
 */

import { HISTOGRAM_BOUNDARIES } from '@pkgs/observability-root-shared-ts/metric-contract';
import {
  alertedObjective,
  bundleIssues,
  standardAlerts,
} from '@pkgs/openslo-shared-ts/alert-policy';
import type { OpenSloDoc } from '@pkgs/openslo-shared-ts/model';
import { ENVIRONMENT_PLACEHOLDER } from './alert-links';
import type { AlertRule } from './alert-rule';
import {
  EMITTED_METRICS,
  emittedMetric,
  emittedSeriesNames,
  labelOf,
  labelsOf,
  seriesNamesOf,
} from './emitted-metrics';
import { tierOf, tiersFor } from './slo-alerts';
import type { Indicator, Matcher, MetricIndicator } from './slo-indicators';
import { INDICATORS, isSampled, metricIndicators } from './slo-indicators';
import { bucketLabel } from './slo-promql';

/** An objective file as the checks see it. */
export type ObjectiveFile = {
  /** Repo-relative path, for messages. */
  readonly path: string;
  /** Measured against a deployment (its first line is `# live`). */
  readonly live: boolean;
  readonly doc: OpenSloDoc;
};

/** Everything wrong between the live objective files and the catalog. */
export function catalogIssues(
  files: readonly ObjectiveFile[]
): readonly string[] {
  const issues: string[] = [];
  const names = INDICATORS.map((i) => i.sli);
  for (const [i, name] of names.entries()) {
    if (names.indexOf(name) !== i)
      issues.push(`the catalog names indicator ${name} twice`);
  }
  for (const file of files) issues.push(...bindingIssues(file));
  const liveSlis = new Set(
    files.flatMap((file) =>
      file.live ? file.doc.slos.map((slo) => slo.indicator) : []
    )
  );
  for (const entry of INDICATORS) {
    if (!liveSlis.has(entry.sli)) {
      issues.push(
        `the catalog binds indicator ${entry.sli}, which no SLO of a live objective file uses`
      );
    }
  }
  for (const indicator of metricIndicators())
    issues.push(...indicatorIssues(indicator));
  for (const file of files) issues.push(...policyIssues(file));
  return issues;
}

/** A live file's indicators must be in the catalog; a harness file's must not. */
function bindingIssues(file: ObjectiveFile): readonly string[] {
  const issues: string[] = [];
  for (const slo of file.doc.slos) {
    const bound = INDICATORS.some((i) => i.sli === slo.indicator);
    if (file.live && !bound) {
      issues.push(
        `${file.path}: SLO ${slo.name} uses indicator ${slo.indicator}, which the catalog (libs/observability-shared-ts/src/slo-indicators.ts) does not bind to an instrument`
      );
    }
    if (!file.live && bound) {
      issues.push(
        `${file.path}: indicator ${slo.indicator} is in the catalog but this file is not marked "# live"`
      );
    }
  }
  return issues;
}

/** Whether one indicator's instrument, labels and bound really exist. */
export function indicatorIssues(indicator: MetricIndicator): readonly string[] {
  const issues: string[] = [];
  const found = EMITTED_METRICS.find(
    (m) => m.contract.name === indicator.metric
  );
  if (found === undefined) {
    return [`${indicator.sli}: no emitted metric named ${indicator.metric}`];
  }
  const want =
    indicator.kind === 'counter-ratio'
      ? 'counter'
      : indicator.kind === 'histogram-under'
        ? 'histogram'
        : 'gauge';
  if (found.contract.type !== want) {
    issues.push(
      `${indicator.sli}: ${indicator.kind} needs a ${want}, but ${indicator.metric} is a ${found.contract.type}`
    );
  }
  const matchers: readonly Matcher[] =
    indicator.kind === 'counter-ratio'
      ? [...indicator.scope, ...indicator.good]
      : indicator.scope;
  for (const matcher of matchers) {
    issues.push(
      ...matcherIssues(indicator.sli, matcher, emittedMetric(indicator.metric))
    );
  }
  if (indicator.kind === 'counter-ratio' && indicator.good.length === 0) {
    issues.push(
      `${indicator.sli}: every event would be good; name what makes one good`
    );
  }
  if (indicator.kind === 'histogram-under') {
    issues.push(
      ...boundIssues(indicator.sli, indicator.underSeconds, found.contract.unit)
    );
  }
  if (indicator.kind === 'sample-under' && found.contract.unit !== 's') {
    issues.push(
      `${indicator.sli}: a bound in seconds needs a gauge in seconds, not ${found.contract.unit}`
    );
  }
  if (
    indicator.lowTraffic !== undefined &&
    indicator.lowTraffic.page < indicator.lowTraffic.push
  ) {
    issues.push(
      `${indicator.sli}: its low-traffic page (${String(indicator.lowTraffic.page)}) needs at least as many bad events as its push (${String(indicator.lowTraffic.push)})`
    );
  }
  return issues;
}

function matcherIssues(
  sli: string,
  matcher: Matcher,
  metric: ReturnType<typeof emittedMetric>
): readonly string[] {
  const vocabulary = metric.contract.dimensions[matcher.dimension];
  if (vocabulary === undefined) {
    return [
      `${sli}: ${metric.contract.name} has no dimension ${matcher.dimension} (it has ${Object.keys(metric.contract.dimensions).join(', ') || 'none'})`,
    ];
  }
  if (matcher.values.length === 0) {
    return [`${sli}: the ${matcher.dimension} matcher selects nothing`];
  }
  if (metric.openDimensions.includes(matcher.dimension)) return [];
  return matcher.values
    .filter((value) => !vocabulary.includes(value))
    .map(
      (value) =>
        `${sli}: ${matcher.dimension} is never "${value}" (it is one of ${vocabulary.join(', ')})`
    );
}

/** A latency bound that is not a bucket edge would silently count the wrong thing. */
function boundIssues(
  sli: string,
  seconds: number,
  unit: string
): readonly string[] {
  const issues: string[] = [];
  if (unit !== 's') {
    issues.push(
      `${sli}: a bound in seconds needs a histogram in seconds, not ${unit}`
    );
  }
  if (!HISTOGRAM_BOUNDARIES.includes(seconds)) {
    issues.push(
      `${sli}: ${String(seconds)}s is not a bucket boundary, so no series counts "at most ${String(seconds)}s" (boundaries: ${HISTOGRAM_BOUNDARIES.join(', ')})`
    );
  }
  if (!/^"[0-9]+(\.[0-9]+)?"$/.test(bucketLabel(seconds))) {
    issues.push(
      `${sli}: ${String(seconds)}s does not print as a plain bucket label`
    );
  }
  return issues;
}

/** Each metric-backed SLO must be alertable: one objective, counted, page and ticket. */
function policyIssues(file: ObjectiveFile): readonly string[] {
  const issues: string[] = [];
  for (const slo of file.doc.slos) {
    const indicator: Indicator | undefined = INDICATORS.find(
      (i) => i.sli === slo.indicator
    );
    if (indicator === undefined) continue;
    const where = `${file.path}: SLO ${slo.name}`;
    try {
      tierOf(slo);
    } catch (cause) {
      issues.push(`${where}: ${(cause as Error).message}`);
    }
    if (slo.objectives.length !== 1) {
      issues.push(
        `${where} has ${String(slo.objectives.length)} objectives; an alerted SLO has exactly one`
      );
      continue;
    }
    if (!slo.timeWindow.isRolling)
      issues.push(`${where} must use a rolling window`);
    const sliced = isSampled(indicator);
    if (!sliced && slo.budgetingMethod !== 'Occurrences') {
      issues.push(
        `${where} must be budgeted by Occurrences; counts cannot be sliced`
      );
    }
    if (sliced && slo.budgetingMethod !== 'Timeslices') {
      issues.push(
        `${where} must be budgeted by Timeslices: each sample is one run of a check`
      );
    }
    alertedObjective(slo);
    const tiers = tiersFor(slo);
    for (const issue of bundleIssues(slo, standardAlerts({ slo, tiers }))) {
      issues.push(`${where}: ${issue}`);
    }
  }
  return issues;
}

/** What a generated or hand-kept rule must carry to be actionable. */
export function ruleIssues(rules: readonly AlertRule[]): readonly string[] {
  const issues: string[] = [];
  const keys = rules.map((r) => r.key);
  for (const rule of rules) {
    const where = `alert rule ${rule.key} (${rule.name})`;
    if (keys.indexOf(rule.key) !== keys.lastIndexOf(rule.key))
      issues.push(`${where} is declared twice`);
    for (const field of [
      'owner',
      'runbook_url',
      'investigate_command',
      'summary',
    ] as const) {
      if (rule[field].trim() === '') issues.push(`${where} has no ${field}`);
    }
    if (!rule.investigate_command.startsWith('bun obs ')) {
      issues.push(
        `${where}: investigate_command must be a bun obs command, got "${rule.investigate_command}"`
      );
    }
    if (!ENVIRONMENT_MATCHER.test(rule.expr)) {
      issues.push(
        `${where} does not select its environment (by label, or by a job's environment suffix), so environments sharing the stack would mix`
      );
    }
    issues.push(...expressionIssues(rule.expr).map((i) => `${where}: ${i}`));
  }
  return issues;
}

/** A label matcher whose value names the environment being applied. */
const ENVIRONMENT_MATCHER = new RegExp(
  `[a-z_]+=~?"[^"]*${ENVIRONMENT_PLACEHOLDER}[^"]*"`
);

const SELECTOR = /([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}/g;
const MATCH = /([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!~|!=|=)\s*"([^"]*)"/g;
/** Series the scrape itself adds; not emitted by the server. */
const BACKEND_SERIES = new Set(['target_info', 'up']);

/**
 * Every metric a PromQL expression selects must be a series the server emits,
 * with only labels and values that series can carry.
 */
export function expressionIssues(expr: string): readonly string[] {
  const issues: string[] = [];
  const known = emittedSeriesNames();
  const selected: string[] = [];
  for (const [, name = '', body = ''] of expr.matchAll(SELECTOR)) {
    if (BACKEND_SERIES.has(name)) continue;
    if (!known.has(name)) {
      issues.push(`selects ${name}, which no emitted metric produces`);
      continue;
    }
    selected.push(name);
    issues.push(...labelProblems(name, body));
  }
  issues.push(...groupingProblems(expr, selected));
  return issues;
}

const GROUPING = /\b(?:by|without)\s*\(([^)]*)\)/g;

/**
 * Every label an expression splits by must be one the series it reads
 * carry: a misspelt `by (…)` label would quietly fold every slice into one,
 * and a failing slice would hide inside the total again.
 */
function groupingProblems(
  expr: string,
  selected: readonly string[]
): readonly string[] {
  if (selected.length === 0) return [];
  const carried = new Set(
    selected.flatMap((series) => {
      const metric = metricOfSeries(series);
      return metric === undefined ? [] : [...labelsOf(metric)];
    })
  );
  return [...expr.matchAll(GROUPING)]
    .flatMap(([, labels = '']) => labels.split(','))
    .map((label) => label.trim())
    .filter((label) => label !== '' && !carried.has(label))
    .filter((label, i, all) => all.indexOf(label) === i)
    .map((label) => `splits by ${label}, which no series it reads carries`);
}

function metricOfSeries(
  series: string
): ReturnType<typeof emittedMetric> | undefined {
  return EMITTED_METRICS.find((m) => seriesNamesOf(m).includes(series));
}

function labelProblems(series: string, body: string): readonly string[] {
  const metric = metricOfSeries(series);
  if (metric === undefined) return [];
  const issues: string[] = [];
  const labels = labelsOf(metric);
  for (const [, label = '', op = '', value = ''] of body.matchAll(MATCH)) {
    if (!labels.has(label)) {
      issues.push(`${series} has no label ${label}`);
      continue;
    }
    if (label === 'le') {
      const bounds = HISTOGRAM_BOUNDARIES.map(String);
      issues.push(
        ...value
          .split('|')
          .filter((bound) => !bounds.includes(bound))
          .map(
            (bound) =>
              `${series}{le} is never "${bound}" (it is one of ${bounds.join(', ')})`
          )
      );
      continue;
    }
    const dimension = Object.keys(metric.contract.dimensions).find(
      (d) => labelOf(d) === label
    );
    const vocabulary =
      dimension === undefined
        ? undefined
        : metric.contract.dimensions[dimension];
    if (
      vocabulary === undefined ||
      metric.openDimensions.includes(dimension ?? '')
    )
      continue;
    const values = op.includes('~') ? value.split('|') : [value];
    for (const v of values.filter(
      (candidate) => !vocabulary.includes(candidate)
    )) {
      issues.push(
        `${series}{${label}} is never "${v}" (it is one of ${vocabulary.join(', ')})`
      );
    }
  }
  return issues;
}
