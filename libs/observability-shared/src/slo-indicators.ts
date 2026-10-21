/**
 * The indicator catalog: which instrument implements each indicator the
 * objective files (`specs/<context>/*.openslo.yaml`) name. The objective
 * files say what a person experiences, in their words; this says how the
 * server's metrics count it. Every live indicator has exactly one entry here
 * and every entry serves an indicator, which `sloCatalogIssues` and its tests
 * enforce, so an objective cannot lose its measurement unnoticed.
 *
 * To add an objective: write the indicator and objective in the spec file,
 * add one entry below. The alert policies, the rules Grafana runs, the hourly
 * evaluation and every consistency check follow from the two.
 */

import {
  HTTP_DURATION_METRIC,
  HTTP_REQUESTS_METRIC,
} from '@pkgs/observability-root-shared/http-metrics';
import { MUTATION_REPLAYS_METRIC } from '@pkgs/observability-root-shared/mutation-metrics';
import { INTERACTIVE_ROUTE_GROUPS, PEOPLE_ROUTE_GROUPS } from './route-groups';

/** Select events by one dimension of the metric. */
export type Matcher = {
  /** The metric dimension (`app.http.route_group`). */
  readonly dimension: string;
  readonly op: 'is' | 'is-not';
  readonly values: readonly string[];
};

type Described = {
  /** The indicator's `metadata.name` in the objective file. */
  readonly sli: string;
  /** Who answers the alert. */
  readonly owner: string;
  /** Fewest events an hour of traffic must hold before a burn rate means anything. */
  readonly minimumEventsPerHour: number;
  /** `bun obs` command that starts an investigation. */
  readonly investigate: 'errors' | 'slow';
};

/** Good events over all events, counted by one counter. */
export type CounterRatioIndicator = Described & {
  readonly kind: 'counter-ratio';
  /** The counter's contract name. */
  readonly metric: string;
  /** Which events are counted at all. */
  readonly scope: readonly Matcher[];
  /** Which of those events are good. */
  readonly good: readonly Matcher[];
};

/** Events no slower than a bound, counted by one duration histogram. */
export type HistogramUnderIndicator = Described & {
  readonly kind: 'histogram-under';
  /** The histogram's contract name. */
  readonly metric: string;
  readonly scope: readonly Matcher[];
  /** Must be one of the histogram's bucket boundaries, in its unit (seconds). */
  readonly underSeconds: number;
};

/** Measured from the hourly Health jobs' own history, not from the metrics. */
export type HealthHistoryIndicator = {
  readonly kind: 'health-job-history';
  readonly sli: string;
};

export type MetricIndicator = CounterRatioIndicator | HistogramUnderIndicator;
export type Indicator = MetricIndicator | HealthHistoryIndicator;

const ROUTE_GROUP = 'app.http.route_group';

const peopleRequests: readonly Matcher[] = [
  { dimension: ROUTE_GROUP, op: 'is', values: PEOPLE_ROUTE_GROUPS },
];
const interactiveRequests: readonly Matcher[] = [
  { dimension: ROUTE_GROUP, op: 'is', values: INTERACTIVE_ROUTE_GROUPS },
];

export const INDICATORS: readonly Indicator[] = [
  {
    kind: 'counter-ratio',
    sli: 'people-requests-served',
    owner: 'runtime',
    minimumEventsPerHour: 60,
    investigate: 'errors',
    metric: HTTP_REQUESTS_METRIC,
    scope: peopleRequests,
    good: [
      { dimension: 'app.http.status_class', op: 'is-not', values: ['5xx'] },
    ],
  },
  {
    kind: 'counter-ratio',
    sli: 'changes-saved-first-time',
    owner: 'runtime',
    minimumEventsPerHour: 5,
    investigate: 'errors',
    metric: MUTATION_REPLAYS_METRIC.name,
    scope: [],
    good: [
      { dimension: 'app.mutation.outcome', op: 'is-not', values: ['failed'] },
    ],
  },
  {
    kind: 'histogram-under',
    sli: 'people-requests-answered-within-half-a-second',
    owner: 'runtime',
    minimumEventsPerHour: 60,
    investigate: 'slow',
    metric: HTTP_DURATION_METRIC,
    scope: interactiveRequests,
    underSeconds: 0.5,
  },
  {
    kind: 'histogram-under',
    sli: 'people-requests-answered-within-two-and-a-half-seconds',
    owner: 'runtime',
    minimumEventsPerHour: 60,
    investigate: 'slow',
    metric: HTTP_DURATION_METRIC,
    scope: interactiveRequests,
    underSeconds: 2.5,
  },
  { kind: 'health-job-history', sli: 'team-checks-passing' },
];

export function indicatorFor(sli: string): Indicator | undefined {
  return INDICATORS.find((candidate) => candidate.sli === sli);
}

export function metricIndicators(): readonly MetricIndicator[] {
  return INDICATORS.filter(
    (candidate): candidate is MetricIndicator =>
      candidate.kind !== 'health-job-history'
  );
}
