/**
 * PromQL for the indicator catalog, generated from the instrument contracts:
 * the metric names come from `prometheusSeries`, the labels from the
 * dimensions, the histogram bound from the bucket boundaries. Nobody types a
 * metric name here.
 *
 * Several environments share one metrics stack, so every query joins
 * `target_info` on its environment: a metric alone cannot say which
 * environment emitted it.
 */

import { emittedMetric, labelOf } from './emitted-metrics';
import { SERVER_SERVICE_NAME } from './service-names';
import type { Matcher, MetricIndicator } from './slo-indicators';

/** Keep only series whose emitting environment is `environment`. */
export function environmentJoin(environment: string): string {
  return ` * on(job, instance) group_left target_info{deployment_environment_name=${JSON.stringify(environment)}}`;
}

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

const SERVER_JOB = `job=${JSON.stringify(SERVER_SERVICE_NAME)}`;

/** The histogram bucket label for a bound: `0.5` → `"0.5"`, `1` → `"1"`. */
export function bucketLabel(seconds: number): string {
  return JSON.stringify(String(seconds));
}

function increase(input: {
  readonly series: string;
  readonly clauses: readonly string[];
  readonly window: string;
  readonly environment: string;
}): string {
  const { series, clauses, window, environment } = input;
  return `sum(increase(${selector(series, [SERVER_JOB, ...clauses])}[${window}])${environmentJoin(environment)})`;
}

export type WindowQueries = {
  /** Events that were good, summed over the window. */
  readonly good: string;
  /** All events, summed over the window. */
  readonly total: string;
};

/** The two PromQL expressions that count an indicator's events over `window`. */
export function windowQueries(input: {
  readonly indicator: MetricIndicator;
  readonly window: string;
  readonly environment: string;
}): WindowQueries {
  const { indicator, window, environment } = input;
  const metric = emittedMetric(indicator.metric);
  const scope = indicator.scope.map(clause);
  const { series } = metric;
  if (indicator.kind === 'counter-ratio' && series.kind === 'counter') {
    return {
      good: increase({
        series: series.total,
        clauses: [...scope, ...indicator.good.map(clause)],
        window,
        environment,
      }),
      total: increase({
        series: series.total,
        clauses: scope,
        window,
        environment,
      }),
    };
  }
  if (indicator.kind === 'histogram-under' && series.kind === 'histogram') {
    return {
      good: increase({
        series: series.bucket,
        clauses: [`le=${bucketLabel(indicator.underSeconds)}`, ...scope],
        window,
        environment,
      }),
      total: increase({
        series: series.count,
        clauses: scope,
        window,
        environment,
      }),
    };
  }
  throw new Error(
    `observability: indicator ${indicator.sli} (${indicator.kind}) does not fit metric ${indicator.metric} (${series.kind})`
  );
}

/**
 * The burn rate over a window as PromQL: how many times faster than the
 * objective allows the bad events are arriving.
 */
export function burnExpression(input: {
  readonly queries: WindowQueries;
  readonly target: number;
}): string {
  const { good, total } = input.queries;
  return `((1 - ${good} / ${total}) / ${numberText(1 - input.target)})`;
}

/** A number as PromQL text with no float noise (`1 - 0.999` is `0.001`). */
export function numberText(value: number): string {
  return String(Number(value.toPrecision(12)));
}
