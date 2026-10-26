/**
 * PromQL for the indicator catalog, generated from the instrument contracts:
 * the metric names come from `prometheusSeries`, the labels from the
 * dimensions, the histogram bound from the bucket boundaries. Nobody types a
 * metric name here.
 *
 * Several environments share one metrics stack, so every query selects its
 * environment: by the label each point carries, or, for Synthetic
 * Monitoring, by the job name's environment suffix (`EnvironmentPlacement`).
 *
 * Every count can be split by one label (`by`), so an alert judges each
 * route group, check or probe on its own and one failing slice cannot hide
 * inside a healthy total.
 */

import type { EmittedMetric } from './emitted-metrics';
import { emittedMetric, labelOf } from './emitted-metrics';
import type { Matcher, MetricIndicator } from './slo-indicators';

function clause(matcher: Matcher): string {
  const label = labelOf(matcher.dimension);
  const [only] = matcher.values;
  if (matcher.values.length === 1 && only !== undefined) {
    return `${label}${matcher.op === 'is' ? '=' : '!='}${JSON.stringify(only)}`;
  }
  return `${label}${matcher.op === 'is' ? '=~' : '!~'}${JSON.stringify(matcher.values.join('|'))}`;
}

function selector(series: string, clauses: readonly string[]): string {
  return `${series}{${clauses.join(',')}}`;
}

/** The histogram bucket label for a bound: `0.5` → `"0.5"`, `1` → `"1"`. */
export function bucketLabel(seconds: number): string {
  return JSON.stringify(String(seconds));
}

/**
 * The matchers that keep one environment's events of `scope`. A job-suffixed
 * metric's job matcher becomes `job=~"(<checks>)-<environment>"`.
 */
export function scopeClauses(input: {
  readonly metric: EmittedMetric;
  readonly scope: readonly Matcher[];
  readonly environment: string;
}): readonly string[] {
  const { metric, scope, environment } = input;
  if (metric.environment.kind === 'label') {
    return [
      `${metric.environment.label}=${JSON.stringify(environment)}`,
      ...scope.map(clause),
    ];
  }
  const jobs = scope.find((m) => m.dimension === 'job' && m.op === 'is');
  const checks = jobs === undefined ? '.+' : `(${jobs.values.join('|')})`;
  return [
    `job=~${JSON.stringify(`${checks}-${environment}`)}`,
    ...scope.filter((m) => m !== jobs).map(clause),
  ];
}

/** `sum` or `sum by (label)`. */
function sum(by: string | null): string {
  return by === null ? 'sum' : `sum by (${by})`;
}

/**
 * Events a counter counted over `window`. Counters are written by
 * short-lived Worker isolates, whose series may report a single sample that
 * `increase` cannot see: growth of series that already existed plus the
 * first value of series that appeared in the window counts each event once.
 * Either part may be empty; the `or`s keep whichever exists, slice by slice.
 */
export function counterCount(input: {
  readonly series: string;
  readonly clauses: readonly string[];
  readonly window: string;
  readonly by?: string | null;
}): string {
  const { series, clauses, window } = input;
  const total = sum(input.by ?? null);
  const picked = selector(series, clauses);
  const grown = `${total}(increase(${picked}[${window}]))`;
  const first = `${total}(min_over_time(${picked}[${window}]) unless min_over_time(${picked}[${window}] offset ${window}))`;
  return `((${grown} + ${first}) or ${grown} or ${first})`;
}

export type WindowQueries = {
  /** Events that were good, summed over the window. */
  readonly good: string;
  /** All events, summed over the window. */
  readonly total: string;
};

/** How far apart a sampled indicator's samples are re-read (one a minute). */
const SAMPLE_STEP = '1m';

/**
 * The two PromQL expressions that count an indicator's events over
 * `window`, in one series, or one per value of the label `by`.
 */
export function windowQueries(input: {
  readonly indicator: MetricIndicator;
  readonly window: string;
  readonly environment: string;
  readonly by?: string | null;
}): WindowQueries {
  const { indicator, window, environment } = input;
  const by = input.by ?? null;
  const metric = emittedMetric(indicator.metric);
  const scope = scopeClauses({
    metric,
    scope: indicator.scope,
    environment,
  });
  const { series } = metric;
  if (indicator.kind === 'counter-ratio' && series.kind === 'counter') {
    const count = (clauses: readonly string[]) =>
      counterCount({ series: series.total, clauses, window, by });
    return {
      good: count([...scope, ...indicator.good.map(clause)]),
      total: count(scope),
    };
  }
  if (indicator.kind === 'histogram-under' && series.kind === 'histogram') {
    const count = (name: string, clauses: readonly string[]) =>
      counterCount({ series: name, clauses, window, by });
    return {
      good: count(series.bucket, [
        ...scope,
        `le=${bucketLabel(indicator.underSeconds)}`,
      ]),
      total: count(series.count, scope),
    };
  }
  if (indicator.kind === 'sample-share' && series.kind === 'gauge') {
    const picked = `${selector(series.value, scope)}[${window}]`;
    return {
      good: `${sum(by)}(sum_over_time(${picked}))`,
      total: `${sum(by)}(count_over_time(${picked}))`,
    };
  }
  if (indicator.kind === 'sample-under' && series.kind === 'gauge') {
    const picked = selector(series.value, scope);
    return {
      good: `${sum(by)}(sum_over_time((${picked} <= bool ${numberText(indicator.underSeconds)})[${window}:${SAMPLE_STEP}]))`,
      total: `${sum(by)}(count_over_time(${picked}[${window}:${SAMPLE_STEP}]))`,
    };
  }
  throw new Error(
    `observability: indicator ${indicator.sli} (${indicator.kind}) does not fit metric ${indicator.metric} (${series.kind})`
  );
}

/** The label an indicator's alerts and Grafana SLO split by, if any. */
export function sliceLabel(indicator: MetricIndicator): string | null {
  return indicator.sliceBy === null ? null : labelOf(indicator.sliceBy);
}

/**
 * The raw samples of a sampled indicator over `window`: each one a run of a
 * check, judged in time slices by the objective check.
 */
export function sampleSelector(input: {
  readonly indicator: MetricIndicator;
  readonly window: string;
  readonly environment: string;
}): string {
  const { indicator, window, environment } = input;
  const metric = emittedMetric(indicator.metric);
  if (
    (indicator.kind !== 'sample-share' && indicator.kind !== 'sample-under') ||
    metric.series.kind !== 'gauge'
  ) {
    throw new Error(
      `observability: indicator ${indicator.sli} is not a share of samples`
    );
  }
  return `${selector(metric.series.value, scopeClauses({ metric, scope: indicator.scope, environment }))}[${window}]`;
}

/** Good over all; a slice with no good events at all is 0, never missing. */
function share(good: string, total: string): string {
  return `((${good}) or (${total}) * 0) / (${total})`;
}

/**
 * The ratio a hosted SLO evaluates (Grafana SLO's freeform query): good over
 * all events per `$__rate_interval`, grouped by the indicator's slice so one
 * failing route group, check or probe shows apart from a healthy total.
 */
export function sloRatioQuery(input: {
  readonly indicator: MetricIndicator;
  readonly environment: string;
}): string {
  const { indicator, environment } = input;
  const metric = emittedMetric(indicator.metric);
  const scope = scopeClauses({
    metric,
    scope: indicator.scope,
    environment,
  });
  const total = sum(sliceLabel(indicator));
  const rated = (name: string, clauses: readonly string[]) =>
    `${total}(rate(${selector(name, clauses)}[$__rate_interval]))`;
  const { series } = metric;
  if (indicator.kind === 'counter-ratio' && series.kind === 'counter') {
    return share(
      rated(series.total, [...scope, ...indicator.good.map(clause)]),
      rated(series.total, scope)
    );
  }
  if (indicator.kind === 'histogram-under' && series.kind === 'histogram') {
    return share(
      rated(series.bucket, [
        ...scope,
        `le=${bucketLabel(indicator.underSeconds)}`,
      ]),
      rated(series.count, scope)
    );
  }
  if (indicator.kind === 'sample-share' && series.kind === 'gauge') {
    const picked = `${selector(series.value, scope)}[$__rate_interval]`;
    return share(
      `${total}(sum_over_time(${picked}))`,
      `${total}(count_over_time(${picked}))`
    );
  }
  if (indicator.kind === 'sample-under' && series.kind === 'gauge') {
    const picked = selector(series.value, scope);
    return share(
      `${total}(sum_over_time((${picked} <= bool ${numberText(indicator.underSeconds)})[$__rate_interval:${SAMPLE_STEP}]))`,
      `${total}(count_over_time(${picked}[$__rate_interval:${SAMPLE_STEP}]))`
    );
  }
  throw new Error(
    `observability: indicator ${indicator.sli} (${indicator.kind}) does not fit metric ${indicator.metric} (${series.kind})`
  );
}

/**
 * The burn rate over a window as PromQL: how many times faster than the
 * objective allows the bad events are arriving. Slice by slice when the
 * queries are split; a slice in which nothing was good burns at its fastest.
 */
export function burnExpression(input: {
  readonly queries: WindowQueries;
  readonly target: number;
}): string {
  const { good, total } = input.queries;
  return `((1 - ${share(good, total)}) / ${numberText(1 - input.target)})`;
}

/**
 * The share of an objective's error budget still left over its window, as
 * PromQL (1 untouched, 0 spent, below 0 overspent).
 */
export function budgetRemainingExpression(input: {
  readonly queries: WindowQueries;
  readonly target: number;
}): string {
  return `(1 - ${burnExpression(input)})`;
}

/** Bad events over the window: all events less the good ones, slice by slice. */
export function badCount(queries: WindowQueries): string {
  return `((${queries.total}) - ((${queries.good}) or (${queries.total}) * 0))`;
}

/** A number as PromQL text with no float noise (`1 - 0.999` is `0.001`). */
export function numberText(value: number): string {
  return String(Number(value.toPrecision(12)));
}
