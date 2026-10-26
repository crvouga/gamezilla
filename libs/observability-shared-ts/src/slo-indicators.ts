/**
 * The indicator catalog: which instrument implements each indicator the
 * objective files (`specs/<context>/*.openslo.yaml`) name. The objective
 * files say what a person experiences, in their words; this says how the
 * server's metrics count it. Every live indicator has exactly one entry here
 * and every entry serves an indicator, which `sloCatalogIssues` and its tests
 * enforce, so an objective cannot lose its measurement unnoticed.
 *
 * To add an objective: write the indicator and objective in the spec file,
 * add one entry below. The alert policies, the rules Grafana runs, the
 * Grafana SLO, the hourly evaluation and every consistency check follow from
 * the two.
 *
 * Three kinds of evidence back an indicator:
 *
 * - people's own requests and saves, counted by the server (`counter-ratio`,
 *   `histogram-under`) — the truth, but too few today for a stable ratio;
 * - the team's checks from outside (`sample-share` over the Health run's
 *   `synthetic.check.result`, and over Synthetic Monitoring's
 *   `probe_success`), one sample per check per run;
 * - the server's own scheduled work (`counter-ratio` on its drain runs).
 */

import {
  HTTP_DURATION_METRIC,
  HTTP_REQUESTS_METRIC,
} from '@pkgs/observability-root-shared-ts/http-metrics';
import { MUTATION_REPLAYS_METRIC } from '@pkgs/observability-root-shared-ts/mutation-metrics';
import { OUTBOX_DRAIN_RUNS_METRIC } from '@pkgs/observability-root-shared-ts/outbox-metrics';
import { INTERACTIVE_ROUTE_GROUPS, PEOPLE_ROUTE_GROUPS } from './route-groups';
import type { SyntheticCheck } from './synthetic-checks';
import {
  SYNTHETIC_CHECK_DIMENSION,
  SYNTHETIC_CHECK_METRIC,
} from './synthetic-checks';
import type { ProbeCheck } from './synthetic-monitoring';
import {
  PROBE_DURATION_METRIC,
  PROBE_SUCCESS_METRIC,
} from './synthetic-monitoring';

/** Select events by one dimension of the metric. */
export type Matcher = {
  /** The metric dimension (`app.http.route_group`). */
  readonly dimension: string;
  readonly op: 'is' | 'is-not';
  readonly values: readonly string[];
};

/**
 * While too few events arrive for a burn rate to mean anything, count the
 * bad ones instead: `push` of them in `window` tells the person on call,
 * `page` of them pages. Zero tolerance for people meeting failures cannot
 * wait for traffic to be large enough for a ratio. Silent once the window
 * holds the indicator's `minimumEventsPerHour`, where the burn rates judge.
 */
export type LowTrafficCount = {
  readonly window: string;
  readonly push: number;
  readonly page: number;
};

/**
 * What tells the team an indicator has stopped being measured at all: no
 * event for `after` raises an alert of `severity`, so silence can never look
 * like a perfect objective.
 */
export type Silence = {
  readonly after: string;
  readonly severity: 'critical' | 'warning';
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
  /**
   * The dimension the Grafana SLO groups by, so one failing route group,
   * check or probe job shows apart from a healthy total.
   */
  readonly sliceBy: string | null;
  /**
   * How often its events arrive, which decides the burn windows: `standard`
   * (5 minutes up to 3 days) for traffic and minute-by-minute checks,
   * `ten-minutely` (30 minutes up to 3 days) for a check every ten minutes,
   * `sparse` (4 hours up to 3 days) for one about once an hour.
   */
  readonly cadence: 'standard' | 'ten-minutely' | 'sparse';
  readonly silence: Silence;
  /**
   * How long the fast burn must hold before it pages; two minutes when
   * unset. Longer for a check whose single failed sample already burns
   * past the fast threshold.
   */
  readonly fastBurnHold?: string;
  /** Bad events that notify while traffic is too low for a burn rate. */
  readonly lowTraffic?: LowTrafficCount;
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

/**
 * The share of a gauge's samples that read 1: each sample is one run of a
 * check from outside, so the objective is budgeted by time slices.
 */
export type SampleShareIndicator = Described & {
  readonly kind: 'sample-share';
  /** The gauge's contract name. */
  readonly metric: string;
  readonly scope: readonly Matcher[];
};

/**
 * The share of a gauge's samples at or under a bound (a probe's duration):
 * each sample is one run of a check from outside, judged by time slices.
 */
export type SampleUnderIndicator = Described & {
  readonly kind: 'sample-under';
  /** The gauge's contract name. */
  readonly metric: string;
  readonly scope: readonly Matcher[];
  /** In the gauge's unit (seconds). */
  readonly underSeconds: number;
};

export type MetricIndicator =
  | CounterRatioIndicator
  | HistogramUnderIndicator
  | SampleShareIndicator
  | SampleUnderIndicator;

/** A share of samples, each one run of a check: judged in time slices. */
export function isSampled(
  indicator: MetricIndicator
): indicator is SampleShareIndicator | SampleUnderIndicator {
  return indicator.kind === 'sample-share' || indicator.kind === 'sample-under';
}
export type Indicator = MetricIndicator;

const ROUTE_GROUP = 'app.http.route_group';

const routeGroups = (values: readonly string[]): readonly Matcher[] => [
  { dimension: ROUTE_GROUP, op: 'is', values },
];

const peopleRequests = routeGroups(PEOPLE_ROUTE_GROUPS);

/** People's requests: about ten a day today, so silence for a day only warns. */
const PEOPLE_SILENCE: Silence = { after: '1d', severity: 'warning' };
/** The Health run is scheduled hourly; GitHub delivers about five a day. */
const HEALTH_SILENCE: Silence = { after: '8h', severity: 'critical' };

function healthChecks(input: {
  readonly sli: string;
  readonly owner: string;
  readonly checks: readonly SyntheticCheck[];
}): SampleShareIndicator {
  return {
    kind: 'sample-share',
    sli: input.sli,
    owner: input.owner,
    // One run every few hours: a tenth of a sample an hour is real traffic.
    minimumEventsPerHour: 0.1,
    investigate: 'errors',
    sliceBy: SYNTHETIC_CHECK_DIMENSION,
    cadence: 'sparse',
    silence: HEALTH_SILENCE,
    metric: SYNTHETIC_CHECK_METRIC.name,
    scope: [
      { dimension: SYNTHETIC_CHECK_DIMENSION, op: 'is', values: input.checks },
    ],
  };
}

function under(input: {
  readonly sli: string;
  readonly groups: readonly string[];
  readonly seconds: number;
  readonly lowTraffic?: LowTrafficCount;
}): HistogramUnderIndicator {
  return {
    ...(input.lowTraffic === undefined ? {} : { lowTraffic: input.lowTraffic }),
    kind: 'histogram-under',
    sli: input.sli,
    owner: 'runtime',
    minimumEventsPerHour: 60,
    investigate: 'slow',
    sliceBy: ROUTE_GROUP,
    cadence: 'standard',
    silence: PEOPLE_SILENCE,
    metric: HTTP_DURATION_METRIC,
    scope: routeGroups(input.groups),
    underSeconds: input.seconds,
  };
}

/** The checks that say the app opens: its shell, and the API ready to serve. */
const OPENING: readonly ProbeCheck[] = ['app-shell', 'api-ready'];

const MINUTE_PROBE_SILENCE: Silence = { after: '10m', severity: 'critical' };

/**
 * At 99.95 in 10000 or stricter, one failed minute-probe in an hour already
 * burns past 14.4x: a lone flaky probe would page. Five minutes later its
 * sample leaves the short window, so holding six pages only a failure that
 * keeps going.
 */
const LONE_PROBE_HOLD = '6m';

function probeDuration(input: {
  readonly sli: string;
  readonly seconds: number;
}): SampleUnderIndicator {
  return {
    kind: 'sample-under',
    sli: input.sli,
    owner: 'runtime',
    minimumEventsPerHour: 60,
    investigate: 'slow',
    sliceBy: 'job',
    cadence: 'standard',
    silence: MINUTE_PROBE_SILENCE,
    fastBurnHold: LONE_PROBE_HOLD,
    metric: PROBE_DURATION_METRIC.name,
    scope: [{ dimension: 'job', op: 'is', values: OPENING }],
    underSeconds: input.seconds,
  };
}

export const INDICATORS: readonly Indicator[] = [
  {
    kind: 'counter-ratio',
    sli: 'people-requests-served',
    owner: 'runtime',
    minimumEventsPerHour: 60,
    investigate: 'errors',
    sliceBy: ROUTE_GROUP,
    cadence: 'standard',
    silence: PEOPLE_SILENCE,
    // One failure a person meets notifies; three in an hour page.
    lowTraffic: { window: '1h', push: 1, page: 3 },
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
    sliceBy: null,
    cadence: 'standard',
    silence: PEOPLE_SILENCE,
    // A failed save is retried, but one is a person's move arriving late.
    lowTraffic: { window: '1h', push: 1, page: 3 },
    metric: MUTATION_REPLAYS_METRIC.name,
    scope: [],
    good: [
      { dimension: 'app.mutation.outcome', op: 'is-not', values: ['failed'] },
    ],
  },
  under({
    sli: 'saves-and-loads-answered-within-half-a-second',
    groups: ['sync'],
    seconds: 0.5,
  }),
  under({
    sli: 'saves-and-loads-answered-within-a-second',
    groups: ['sync'],
    seconds: 1,
    // Today 2 in 100 saves take over a second: three in an hour is a trend.
    lowTraffic: { window: '1h', push: 3, page: 10 },
  }),
  under({
    sli: 'sign-in-requests-answered-within-a-quarter-second',
    groups: ['session'],
    seconds: 0.25,
  }),
  under({
    sli: 'sign-in-requests-answered-within-a-second',
    groups: ['session'],
    seconds: 1,
    lowTraffic: { window: '1h', push: 3, page: 10 },
  }),
  under({
    sli: 'people-requests-answered-within-two-and-a-half-seconds',
    groups: INTERACTIVE_ROUTE_GROUPS,
    seconds: 2.5,
    // Past 2.5 s a person gives up: one notifies, three in an hour page.
    lowTraffic: { window: '1h', push: 1, page: 3 },
  }),
  {
    kind: 'sample-share',
    sli: 'outside-pings-answered',
    owner: 'runtime',
    // One sample a minute per check.
    minimumEventsPerHour: 60,
    investigate: 'errors',
    sliceBy: 'job',
    cadence: 'standard',
    silence: MINUTE_PROBE_SILENCE,
    fastBurnHold: LONE_PROBE_HOLD,
    metric: PROBE_SUCCESS_METRIC.name,
    scope: [{ dimension: 'job', op: 'is', values: OPENING }],
  },
  probeDuration({ sli: 'outside-pings-answered-within-a-second', seconds: 1 }),
  probeDuration({
    sli: 'outside-pings-answered-within-two-and-a-half-seconds',
    seconds: 2.5,
  }),
  {
    kind: 'sample-share',
    sli: 'broker-pings-answered',
    owner: 'runtime',
    // One sample every ten minutes.
    minimumEventsPerHour: 3,
    investigate: 'errors',
    sliceBy: null,
    cadence: 'ten-minutely',
    silence: { after: '40m', severity: 'critical' },
    metric: PROBE_SUCCESS_METRIC.name,
    scope: [{ dimension: 'job', op: 'is', values: ['broker'] }],
  },
  healthChecks({
    sli: 'team-checks-passing',
    owner: 'runtime',
    checks: ['runtime.reaching-the-app', 'runtime.serving-people'],
  }),
  healthChecks({
    sli: 'sign-in-checks-passing',
    owner: 'auth',
    checks: ['auth.sign-in'],
  }),
  healthChecks({
    sli: 'space-checks-passing',
    owner: 'spaces',
    checks: ['spaces.spaces'],
  }),
  healthChecks({
    sli: 'live-update-checks-passing',
    owner: 'spaces',
    checks: ['spaces.live-updates'],
  }),
  healthChecks({
    sli: 'game-journeys-passing',
    owner: 'games',
    checks: [
      'battleship.battleship-health',
      'connect-four.connect-four-health',
      'journeys.battleship-game',
      'journeys.connect-four-game',
      'journeys.critical-journeys',
      'journeys.custom-game',
      'journeys.join-and-offline',
      'journeys.multiplayer-game',
      'journeys.numberlink-packs',
      'journeys.pong-game',
      'journeys.quoridor-game',
      'journeys.sokoban-packs',
      'quoridor.quoridor-health',
    ],
  }),
  healthChecks({
    sli: 'outside-service-checks-passing',
    owner: 'runtime',
    checks: ['runtime.connected-services', 'runtime.stored-files'],
  }),
  healthChecks({
    sli: 'payment-checks-passing',
    owner: 'billing',
    checks: ['billing.payments'],
  }),
  healthChecks({
    sli: 'team-tool-checks-passing',
    owner: 'observability',
    checks: [
      'profile.finding-a-person',
      'runtime.declared-environment',
      'runtime.request-records',
    ],
  }),
  {
    kind: 'counter-ratio',
    sli: 'background-runs-completing',
    owner: 'runtime',
    // The drain is scheduled every minute.
    minimumEventsPerHour: 30,
    investigate: 'errors',
    sliceBy: null,
    cadence: 'standard',
    silence: { after: '15m', severity: 'critical' },
    metric: OUTBOX_DRAIN_RUNS_METRIC.name,
    scope: [],
    good: [{ dimension: 'app.outcome', op: 'is', values: ['success'] }],
  },
];

export function indicatorFor(sli: string): Indicator | undefined {
  return INDICATORS.find((candidate) => candidate.sli === sli);
}

export function metricIndicators(): readonly MetricIndicator[] {
  return INDICATORS;
}
