/**
 * The standard alert policy of an SLO, generated from the SLO itself.
 *
 * Multi-window, multi-burn-rate alerts (Google SRE Workbook, "Alerting on
 * SLOs"): a policy fires when a long window shows the budget burning fast
 * enough to matter and a short window shows it is still burning now. The
 * long window keeps a brief blip from paging; the short one stops the page
 * once the problem has gone. Nothing here is written per SLO: the same
 * tiers apply to every objective, scaled by its own target.
 *
 * | tier         | severity | burn   | long | short | budget spent (28d / 7d window) |
 * | ------------ | -------- | ------ | ---- | ----- | ------------------------------ |
 * | fast burn    | page     | 14.4x  | 1h   | 5m    | 2.1 % / 8.6 %                  |
 * | slow burn    | page     | 6x     | 6h   | 30m   | 5.4 % / 21.4 %                 |
 * | daily burn   | ticket   | 3x     | 1d   | 2h    | 10.7 % / 42.9 %                |
 * | budget drift | ticket   | 1x     | 3d   | 6h    | 10.7 % / 42.9 %                |
 *
 * The two page tiers together are the workbook's (and a hosted SLO
 * service's) fast-burn alert; the two ticket tiers its slow-burn alert. The
 * workbook states 2 %, 5 % and 10 % for a 30-day window; a shorter window
 * spends a larger share for the same burn rate (`budgetSpent`).
 */

import type { Counts } from './burn-rate';
import { burnRate, errorBudget, maxBurnRate } from './burn-rate';
import { compare } from './evaluate';
import type {
  AlertCondition,
  AlertNotificationTarget,
  AlertPolicy,
  Objective,
  Slo,
} from './model';
import { parseDuration } from './window';

export type BurnTier = {
  readonly name: string;
  readonly severity: string;
  /** Times faster than sustainable. */
  readonly factor: number;
  readonly longWindow: string;
  readonly shortWindow: string;
  readonly summary: string;
};

export const STANDARD_BURN_TIERS: readonly BurnTier[] = [
  {
    name: 'fast-burn',
    severity: 'page',
    factor: 14.4,
    longWindow: '1h',
    shortWindow: '5m',
    summary: 'is spending its error budget at a rate that ends it within hours',
  },
  {
    name: 'slow-burn',
    severity: 'page',
    factor: 6,
    longWindow: '6h',
    shortWindow: '30m',
    summary:
      'is spending its error budget steadily enough to end it within days',
  },
  {
    name: 'daily-burn',
    severity: 'ticket',
    factor: 3,
    longWindow: '1d',
    shortWindow: '2h',
    summary:
      'is spending its error budget fast enough to end it within the window',
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

export type AlertBundle = {
  readonly conditions: readonly AlertCondition[];
  readonly policies: readonly AlertPolicy[];
  readonly targets: readonly AlertNotificationTarget[];
};

/** The objective an SLO's alerts defend: its one and only. */
export function alertedObjective(slo: Slo): Objective {
  const [only] = slo.objectives;
  if (only === undefined || slo.objectives.length !== 1) {
    throw new Error(
      `openslo: SLO ${slo.name} has ${String(slo.objectives.length)} objectives; alerts defend exactly one`
    );
  }
  return only;
}

export function standardAlerts(input: {
  readonly slo: Slo;
  /** Where the policies send alerts; none when only evaluating in memory. */
  readonly targets?: readonly AlertNotificationTarget[];
  readonly tiers?: readonly BurnTier[];
}): AlertBundle {
  const { slo } = input;
  const targets = input.targets ?? [];
  const objective = alertedObjective(slo);
  const conditions: AlertCondition[] = [];
  const policies: AlertPolicy[] = [];
  for (const tier of input.tiers ?? STANDARD_BURN_TIERS) {
    const policyName = `${slo.name}-${tier.name}`;
    const own = [tier.longWindow, tier.shortWindow].map((window) =>
      condition({ policyName, tier, window })
    );
    conditions.push(...own);
    policies.push({
      name: policyName,
      displayName: `${slo.displayName ?? slo.name}: ${tier.name}`,
      description: `${tier.severity}: ${slo.displayName ?? slo.name} ${tier.summary}: "${objective.displayName}" burns at ${String(tier.factor)}x or more over ${tier.longWindow} and over ${tier.shortWindow}.`,
      alertWhenNoData: false,
      alertWhenResolved: true,
      alertWhenBreaching: true,
      conditions: own.map((c) => c.name),
      notificationTargets: targets.map((t) => t.name),
      labels: { slo: [slo.name], severity: [tier.severity] },
    });
  }
  return { conditions, policies, targets };
}

function condition(input: {
  readonly policyName: string;
  readonly tier: BurnTier;
  readonly window: string;
}): AlertCondition {
  const { policyName, tier, window } = input;
  return {
    name: `${policyName}-over-${window}`,
    displayName: null,
    description: `The budget burns at ${String(tier.factor)}x or more over the last ${window}.`,
    severity: tier.severity,
    op: 'gte',
    threshold: tier.factor,
    lookbackWindow: window,
    alertAfter: null,
  };
}

/** Why a bundle cannot work for an SLO; empty when it can. */
export function bundleIssues(slo: Slo, bundle: AlertBundle): readonly string[] {
  const issues: string[] = [];
  const target = alertedObjective(slo).target;
  const windowMs = parseDuration(slo.timeWindow.duration) ?? 0;
  const byName = new Map(bundle.conditions.map((c) => [c.name, c]));
  for (const policy of bundle.policies) {
    for (const name of policy.conditions) {
      const found = byName.get(name);
      if (found === undefined) {
        issues.push(`policy ${policy.name} names missing condition ${name}`);
        continue;
      }
      if (found.threshold > maxBurnRate(target)) {
        issues.push(
          `${policy.name}: ${String(found.threshold)}x can never be reached by an objective of ${String(target)} (at most ${String(maxBurnRate(target))}x)`
        );
      }
      if ((parseDuration(found.lookbackWindow) ?? 0) > windowMs) {
        issues.push(
          `${policy.name}: looks back ${found.lookbackWindow}, further than the ${slo.timeWindow.duration} window`
        );
      }
    }
  }
  const severities = new Set(bundle.conditions.map((c) => c.severity));
  for (const needed of ['page', 'ticket']) {
    if (!severities.has(needed)) {
      issues.push(`SLO ${slo.name} has no ${needed} alert`);
    }
  }
  return issues;
}

export type ConditionReading = {
  readonly condition: AlertCondition;
  readonly counts: Counts;
  /** `null` when nothing was counted in the window. */
  readonly burn: number | null;
  readonly holds: boolean;
};

export type PolicyState = 'firing' | 'quiet' | 'low-traffic' | 'no-data';

export type PolicyEvaluation = {
  readonly policy: AlertPolicy;
  readonly state: PolicyState;
  readonly readings: readonly ConditionReading[];
};

/**
 * Judge one policy against counts per lookback window.
 *
 * - `no-data`: the longest window counted nothing at all. The pipeline, not
 *   the product, is the suspect; callers fail on it.
 * - `low-traffic`: the longest window saw fewer than `minimumEventsPerHour`
 *   per hour it covers, too few for a rate to mean anything.
 * - `firing`: every condition holds. Otherwise `quiet`.
 */
export function evaluatePolicy(input: {
  readonly policy: AlertPolicy;
  readonly conditions: readonly AlertCondition[];
  readonly target: number;
  readonly counts: (lookbackWindow: string) => Counts;
  readonly minimumEventsPerHour: number;
}): PolicyEvaluation {
  const readings = input.conditions.map((c): ConditionReading => {
    const counts = input.counts(c.lookbackWindow);
    const burn = burnRate(counts, input.target);
    return {
      condition: c,
      counts,
      burn,
      holds: burn !== null && compare(c.op, steady(burn), c.threshold),
    };
  });
  const longest = readings.reduce<ConditionReading | null>(
    (best, r) =>
      best === null ||
      (parseDuration(r.condition.lookbackWindow) ?? 0) >
        (parseDuration(best.condition.lookbackWindow) ?? 0)
        ? r
        : best,
    null
  );
  return {
    policy: input.policy,
    readings,
    state: stateOf(longest, readings, input),
  };
}

/**
 * A burn computed from counts carries float noise (144 bad of 10 000 against
 * a 0.1 % budget is 14.399999999999999, not 14.4), so a limit met exactly
 * must still count as met.
 */
function steady(burn: number): number {
  return Number.isFinite(burn) ? Number(burn.toPrecision(12)) : burn;
}

function stateOf(
  longest: ConditionReading | null,
  readings: readonly ConditionReading[],
  input: { readonly minimumEventsPerHour: number }
): PolicyState {
  if (longest === null || longest.counts.total <= 0) return 'no-data';
  const hours =
    (parseDuration(longest.condition.lookbackWindow) ?? 0) / 3_600_000;
  if (longest.counts.total < input.minimumEventsPerHour * hours) {
    return 'low-traffic';
  }
  return readings.every((r) => r.holds) ? 'firing' : 'quiet';
}

/** One line a person can act on: which windows burn how fast. */
export function describeReadings(
  readings: readonly ConditionReading[],
  target: number
): string {
  const parts = readings.map((r) => {
    const burn = r.burn === null ? 'no events' : `${format(r.burn)}x`;
    return `${burn} over ${r.condition.lookbackWindow} (limit ${String(r.condition.threshold)}x, ${String(r.counts.total)} events)`;
  });
  return `${parts.join(', ')}; the objective allows ${format(errorBudget(target) * 100)}% bad events`;
}

function format(value: number): string {
  return Number.isFinite(value)
    ? String(Number(value.toPrecision(4)))
    : String(value);
}
