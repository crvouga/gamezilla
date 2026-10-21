/**
 * Judge an SLO's burn-rate policies against a binding's measures, the way
 * `check` judges its objectives. Each distinct lookback window is measured
 * once (a measure is asked for that window's `startMs`..`endMs`), then every
 * policy is evaluated from the counts. This is what makes a live objective
 * file an alerting path of its own: a policy that fires fails its test, with
 * the response a person needs.
 */

import type { AlertBundle, ConditionReading } from './alert-policy';
import {
  alertedObjective,
  describeReadings,
  evaluatePolicy,
  standardAlerts,
} from './alert-policy';
import type { Counts } from './burn-rate';
import { budgetRemaining } from './burn-rate';
import type { Measurement } from './evaluate';
import type { AlertPolicy, OpenSloDoc, Slo } from './model';
import type { ObjectivesBinding } from './registry';
import { parseDuration, withinBounds } from './window';

export type AlertResult = {
  /** The evidence obligation: `alert:<slo>:<policy>`. */
  readonly id: string;
  readonly slo: string;
  readonly policy: string;
  /** Quiet, or too little traffic to judge; false means a person must act. */
  readonly ok: boolean;
  readonly detail: string;
};

export function alertId(slo: string, policy: string): string {
  return `alert:${slo}:${policy}`;
}

/** The file's own policies for an SLO when it names any, else the standard ones. */
export function bundleFor(doc: OpenSloDoc, slo: Slo): AlertBundle {
  if (slo.alertPolicies.length === 0) return standardAlerts({ slo });
  const policies = doc.alertPolicies.filter((p) =>
    slo.alertPolicies.includes(p.name)
  );
  const names = new Set(policies.flatMap((p) => p.conditions));
  return {
    policies,
    conditions: doc.alertConditions.filter((c) => names.has(c.name)),
    targets: doc.alertNotificationTargets,
  };
}

export async function measureAlerts(input: {
  readonly doc: OpenSloDoc;
  readonly slo: Slo;
  readonly binding: ObjectivesBinding;
}): Promise<readonly AlertResult[]> {
  const { doc, slo, binding } = input;
  const alerting = binding.alerting;
  if (alerting === undefined) return [];
  const bundle = bundleFor(doc, slo);
  const fail = (detail: string) =>
    bundle.policies.map((p) => result(slo, p, false, detail));
  if (slo.objectives.length !== 1) {
    return fail(
      `SLO ${slo.name} has ${String(slo.objectives.length)} objectives; alerts defend exactly one`
    );
  }
  const target = alertedObjective(slo).target;
  const clock = binding.nowMs?.() ?? null;
  const measure = binding.measure[slo.indicator];
  if (clock === null || measure === undefined) {
    return fail(
      `alerting needs the binding's nowMs and a measure for SLI ${slo.indicator}`
    );
  }
  const counts = new Map<string, Counts>();
  try {
    const windows = new Set([
      slo.timeWindow.duration,
      ...bundle.conditions.map((c) => c.lookbackWindow),
    ]);
    for (const window of windows) {
      const ms = parseDuration(window) ?? 0;
      const bounds = { startMs: clock - ms, endMs: clock };
      counts.set(
        window,
        countsOf(await measure({ nowMs: clock, ...bounds }), bounds)
      );
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return fail(`the measure for SLI ${slo.indicator} failed: ${message}`);
  }
  const ofWindow = (window: string): Counts =>
    counts.get(window) ?? { good: 0, total: 0 };
  const remaining = budgetRemaining(ofWindow(slo.timeWindow.duration), target);
  return bundle.policies.map((policy) => {
    const evaluation = evaluatePolicy({
      policy,
      conditions: policy.conditions.flatMap((name) =>
        bundle.conditions.filter((c) => c.name === name)
      ),
      target,
      counts: ofWindow,
      minimumEventsPerHour: alerting.minimumEventsPerHour(slo),
    });
    const readings = describeReadings(evaluation.readings, target);
    const budget = `${percent(remaining)} of the ${slo.timeWindow.duration} error budget remains`;
    const severity = evaluation.readings[0]?.condition.severity ?? 'alert';
    if (evaluation.state === 'firing') {
      const response = alerting.respond({
        slo,
        policy,
        lookbackWindow: longestLookback(evaluation.readings),
      });
      return result(
        slo,
        policy,
        false,
        `${severity.toUpperCase()} ${slo.name} (${policy.name}) is firing: ${readings}; ${budget}. Owner: ${response.owner}. Runbook: ${response.runbook}. Investigate with: ${response.command}`
      );
    }
    if (evaluation.state === 'no-data') {
      return result(
        slo,
        policy,
        false,
        `no evidence: no events were counted over the longest lookback window, so no burn rate can be judged (is telemetry reaching the metrics backend?)`
      );
    }
    const why =
      evaluation.state === 'low-traffic'
        ? 'too little traffic in the longest window to judge'
        : 'not firing';
    return result(slo, policy, true, `${why}: ${readings}; ${budget}`);
  });
}

function longestLookback(readings: readonly ConditionReading[]): string {
  let longest = '';
  let longestMs = -1;
  for (const { condition } of readings) {
    const ms = parseDuration(condition.lookbackWindow) ?? 0;
    if (ms > longestMs) {
      longest = condition.lookbackWindow;
      longestMs = ms;
    }
  }
  return longest;
}

function result(
  slo: Slo,
  policy: AlertPolicy,
  ok: boolean,
  detail: string
): AlertResult {
  return {
    id: alertId(slo.name, policy.name),
    slo: slo.name,
    policy: policy.name,
    ok,
    detail,
  };
}

function percent(share: number | null): string {
  return share === null
    ? 'unknown share'
    : `${String(Math.round(share * 1000) / 10)}%`;
}

/** Good and total events a measurement holds inside `bounds`. */
function countsOf(
  measurement: Measurement,
  bounds: { readonly startMs: number; readonly endMs: number }
): Counts {
  if (measurement.kind === 'totals') {
    return { good: measurement.good, total: measurement.total };
  }
  if (measurement.kind === 'events') {
    const inside = measurement.events.filter((e) =>
      withinBounds(e.atMs, bounds)
    );
    return {
      good: inside.filter((e) => e.good).length,
      total: inside.length,
    };
  }
  throw new Error(
    'alerts need a ratio indicator measured as events or totals, not samples'
  );
}
