/**
 * What an alert on an objective carries, and how it reaches a person.
 *
 * Two paths run the same policies (`@pkgs/openslo-shared-ts`'s
 * `standardAlerts`, in the windows the indicator's cadence allows),
 * generated from each objective's own target:
 *
 * - the hourly Health job evaluates them against the metrics backend and
 *   fails when one fires (`alertingBinding`), so it works with no dashboard
 *   service at all;
 * - Grafana evaluates the rules generated into `alert-rules.generated.json`
 *   (`slo-alert-rules`) whenever its instance is active, and routes each by
 *   its `route` label: `page` to Grafana IRM's paging chain, `push` to its
 *   push-only chain, `digest` to the daily summary.
 *
 * The objective's tier (`tier` in the objective file's labels) decides
 * how loudly: a page of tier 0 or 1 pages; a tier 2 page only pushes; a
 * ticket pushes, and a tier 2 ticket waits for the digest.
 */

import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';
import type {
  AlertBundle,
  BurnTier,
} from '@pkgs/openslo-shared-ts/alert-policy';
import {
  alertedObjective,
  STANDARD_BURN_TIERS,
  standardAlerts,
} from '@pkgs/openslo-shared-ts/alert-policy';
import { maxBurnRate } from '@pkgs/openslo-shared-ts/burn-rate';
import type {
  AlertNotificationTarget,
  OpenSloDoc,
  Slo,
} from '@pkgs/openslo-shared-ts/model';
import type { AlertingBinding } from '@pkgs/openslo-shared-ts/registry';
import { parseDuration } from '@pkgs/openslo-shared-ts/window';
import type { MetricIndicator } from './slo-indicators';
import { indicatorFor } from './slo-indicators';

/** The source repository's files on `main`. */
export const REPOSITORY_URL = `https://github.com/${PRODUCT.external.sourceRepository}/blob/main`;

/** Where the team reads how objectives and their alerts work. */
export const README_URL = `${REPOSITORY_URL}/libs/observability-shared-ts/README.md#service-level-objectives`;

/** One section per objective, keyed by its `metadata.name`. */
export const RUNBOOK_URL = `${REPOSITORY_URL}/docs/SLO_RUNBOOK.md`;

export function runbookFor(sloName: string): string {
  return `${RUNBOOK_URL}#${sloName}`;
}

/** How far back `bun obs` can usefully look: Tempo keeps three days. */
const LONGEST_INVESTIGATION = '3d';

/** The objective file's label that ranks how much an objective matters. */
export const TIER_LABEL = 'tier';

export const TIERS = [0, 1, 2] as const;
export type Tier = (typeof TIERS)[number];

/** The objective's tier, or why it has none. */
export function tierOf(slo: Slo): Tier {
  const [only, ...rest] = slo.labels[TIER_LABEL] ?? [];
  const tier = TIERS.find((candidate) => String(candidate) === only);
  if (tier === undefined || rest.length > 0) {
    throw new Error(
      `observability: SLO ${slo.name} needs exactly one ${TIER_LABEL} label of ${TIERS.join(', ')}`
    );
  }
  return tier;
}

export const ROUTES = ['page', 'push', 'digest'] as const;
export type Route = (typeof ROUTES)[number];

/** Where an alert of `severity` on an objective of `tier` goes. */
export function routeOf(severity: 'critical' | 'warning', tier: Tier): Route {
  if (severity === 'critical') return tier <= 1 ? 'page' : 'push';
  return tier <= 1 ? 'push' : 'digest';
}

/**
 * Burn windows for a check that samples about once an hour: a five-minute
 * window would almost never hold a sample, so it could never fire. A page
 * needs a tenth of the budget's pace sustained over half a day and still
 * true over the last four hours (about two failed runs in a row); a ticket
 * the budget's own pace over three days and the last twelve hours.
 */
export const SPARSE_BURN_TIERS: readonly BurnTier[] = [
  {
    name: 'fast-burn',
    severity: 'page',
    factor: 10,
    longWindow: '12h',
    shortWindow: '4h',
    summary:
      'is failing its checks from outside often enough to end its error budget within a day',
  },
  {
    name: 'budget-drift',
    severity: 'ticket',
    factor: 1,
    longWindow: '3d',
    shortWindow: '12h',
    summary: 'is spending its error budget faster than the window renews it',
  },
];

/**
 * Burn windows for a check every ten minutes: the short window holds three
 * samples, the long one eighteen, so two failed runs in a row page (about
 * twenty minutes) while one lone failure does not.
 */
export const TEN_MINUTELY_BURN_TIERS: readonly BurnTier[] = [
  {
    name: 'fast-burn',
    severity: 'page',
    factor: 14.4,
    longWindow: '3h',
    shortWindow: '30m',
    summary: 'is spending its error budget at a rate that ends it within hours',
  },
  {
    name: 'budget-drift',
    severity: 'ticket',
    factor: 1,
    longWindow: '3d',
    shortWindow: '6h',
    summary: 'is spending its error budget faster than the window renews it',
  },
];

const TIERS_BY_CADENCE = {
  standard: STANDARD_BURN_TIERS,
  'ten-minutely': TEN_MINUTELY_BURN_TIERS,
  sparse: SPARSE_BURN_TIERS,
} as const;

/** The highest share of the fastest possible burn a tier may ask for. */
const REACHABLE_SHARE = 0.75;

/**
 * The burn tiers that judge an SLO: by how often its indicator is sampled,
 * each held below the fastest burn its target allows. An objective of 85 in
 * 100 can burn at most 6.7 times too fast (every event bad), so a 14.4x page
 * could never fire; it pages at 5x, when three in four events are bad.
 */
export function tiersFor(slo: Slo): readonly BurnTier[] {
  const indicator = metricIndicatorOf(slo);
  const base = TIERS_BY_CADENCE[indicator.cadence];
  const ceiling =
    Math.floor(
      maxBurnRate(alertedObjective(slo).target) * REACHABLE_SHARE * 10
    ) / 10;
  return base.map((tier) =>
    tier.factor <= ceiling ? tier : { ...tier, factor: ceiling }
  );
}

const HEALTH_JOB: AlertNotificationTarget = {
  name: 'health-job-failure',
  displayName: null,
  description:
    'The hourly Health run fails its objectives job, and GitHub notifies the people watching the repository. Works with no dashboard service.',
  target: 'github-actions',
};

/** Where Grafana sends an alert, by its `route` label. */
const ROUTE_TARGETS: Readonly<Record<Route, AlertNotificationTarget>> = {
  page: {
    name: 'grafana-irm-page',
    displayName: null,
    description:
      'Grafana raises the alert into Grafana IRM, whose paging chain notifies the person on call with their important notification rules.',
    target: 'grafana-irm',
  },
  push: {
    name: 'grafana-irm-push',
    displayName: null,
    description:
      'Grafana raises the alert into Grafana IRM, whose push chain notifies the person on call with their default notification rules and never pages.',
    target: 'grafana-irm',
  },
  digest: {
    name: 'grafana-daily-digest',
    displayName: null,
    description: 'Grafana holds the alert and sends it in one summary a day.',
    target: 'grafana',
  },
};

/** The places an alert goes. Each policy tells the Health job and its route. */
export const ALERT_TARGETS: readonly AlertNotificationTarget[] = [
  HEALTH_JOB,
  ...ROUTES.map((route) => ROUTE_TARGETS[route]),
];

/** `page` severity is Grafana's `critical`; anything else is `warning`. */
export function grafanaSeverity(severity: string): 'critical' | 'warning' {
  return severity === 'page' ? 'critical' : 'warning';
}

/** The exact command that starts investigating an alert looking back `lookback`. */
export function investigationCommand(input: {
  readonly indicator: MetricIndicator;
  readonly lookback: string;
}): string {
  const asked = parseDuration(input.lookback) ?? 0;
  const longest = parseDuration(LONGEST_INVESTIGATION) ?? 0;
  const since = asked > longest ? LONGEST_INVESTIGATION : input.lookback;
  return `bun obs ${input.indicator.investigate} --since ${since} --source prod`;
}

/** The SLO's metric indicator, or why it has none. */
export function metricIndicatorOf(slo: Slo): MetricIndicator {
  const indicator = indicatorFor(slo.indicator);
  if (indicator === undefined) {
    throw new Error(
      `observability: SLO ${slo.name} has no metric indicator in the catalog (SLI ${slo.indicator})`
    );
  }
  return indicator;
}

/** Alerting for a binding whose SLIs are all in the catalog. */
export function alertingBinding(): AlertingBinding {
  return {
    minimumEventsPerHour: (slo) => metricIndicatorOf(slo).minimumEventsPerHour,
    tiers: tiersFor,
    respond: ({ slo, lookbackWindow }) => {
      const indicator = metricIndicatorOf(slo);
      return {
        owner: indicator.owner,
        runbook: runbookFor(slo.name),
        command: investigationCommand({ indicator, lookback: lookbackWindow }),
      };
    },
  };
}

/** The SLOs of these files that the metrics measure, in file order. */
export function metricBackedSlos(docs: readonly OpenSloDoc[]): readonly Slo[] {
  return docs
    .flatMap((doc) => doc.slos)
    .filter((slo) => indicatorFor(slo.indicator) !== undefined);
}

/** One SLO's policies, each telling the Health job and the route its tier picks. */
export function sloAlerts(slo: Slo): AlertBundle {
  const tiers = tiersFor(slo);
  const tier = tierOf(slo);
  const bundle = standardAlerts({ slo, targets: ALERT_TARGETS, tiers });
  return {
    ...bundle,
    policies: bundle.policies.map((policy) => {
      const severity =
        bundle.conditions.find((c) => c.name === policy.conditions[0])
          ?.severity ?? 'ticket';
      const route = routeOf(grafanaSeverity(severity), tier);
      return {
        ...policy,
        notificationTargets: [HEALTH_JOB.name, ROUTE_TARGETS[route].name],
        labels: { ...policy.labels, tier: [String(tier)], route: [route] },
      };
    }),
  };
}

/** Every policy of every metric-backed SLO, with the shared targets. */
export function sloAlertBundle(docs: readonly OpenSloDoc[]): AlertBundle {
  const bundles = metricBackedSlos(docs).map(sloAlerts);
  return {
    conditions: bundles.flatMap((b) => b.conditions),
    policies: bundles.flatMap((b) => b.policies),
    targets: ALERT_TARGETS,
  };
}
