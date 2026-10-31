/**
 * The team's checks from outside, as metrics: every live feature the Health
 * run decides (the critical journeys and every `@synthetic` feature) is one
 * check, and each run records one sample per check — 1 when every scenario
 * it decided passed, 0 otherwise. An objective counts those samples, so a
 * check that did not run is no evidence, never a pass.
 *
 * The check names are a closed vocabulary (a metric label can never be an
 * open value); a test fails until a new live feature is named here and
 * assigned to an indicator in `slo-indicators.ts`.
 */

import { technicalName } from '@libs/product-identity-shared-ts/technical-names';
import type { MetricContract } from '@pkgs/observability-root-shared-ts/metric-contract';
import { otlpGaugeRequest } from '@pkgs/observability-root-shared-ts/otlp-gauge';

/** Each live feature's check name: `<context>.<feature stem>`. */
export const SYNTHETIC_CHECKS = [
  'auth.sign-in',
  'battleship.battleship-health',
  'billing.payments',
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
  'profile.finding-a-person',
  'quoridor.quoridor-health',
  'runtime.connected-services',
  'runtime.declared-environment',
  'runtime.reaching-the-app',
  'runtime.request-records',
  'runtime.serving-people',
  'runtime.stored-files',
  'spaces.live-updates',
  'spaces.spaces',
] as const;

export type SyntheticCheck = (typeof SYNTHETIC_CHECKS)[number];

export const SYNTHETIC_CHECK_DIMENSION = 'app.synthetic.check';

/** One sample per check per Health run: 1 passed, 0 failed. */
export const SYNTHETIC_CHECK_METRIC: MetricContract = {
  name: 'synthetic.check.result',
  description:
    'One sample per live feature per Health run: 1 when every scenario it decided passed, 0 when any failed or it decided none',
  type: 'gauge',
  unit: '{result}',
  dimensions: { [SYNTHETIC_CHECK_DIMENSION]: SYNTHETIC_CHECKS },
  environmentScoped: true,
};

/** `specs/auth/sign-in.feature` → `auth.sign-in`; `null` for any other path. */
export function checkOfFeature(featureUri: string): SyntheticCheck | null {
  const match = /^specs\/([a-z0-9-]+)\/([a-z0-9-]+)\.feature$/.exec(featureUri);
  if (match === null) return null;
  const name = `${match[1] ?? ''}.${match[2] ?? ''}`;
  return (SYNTHETIC_CHECKS as readonly string[]).includes(name)
    ? (name as SyntheticCheck)
    : null;
}

/** A feature the run selected, and what its scenarios decided. */
export type FeatureVerdict = {
  readonly featureUri: string;
  /** Every decided scenario's status; empty when the feature decided none. */
  readonly statuses: readonly ('pass' | 'fail')[];
};

export type CheckResult = {
  readonly check: SyntheticCheck;
  readonly passed: boolean;
};

/**
 * One result per selected feature that is a check. A feature that decided
 * no scenario (it crashed, or never started) failed: silence is not a pass.
 * A selected feature with no check name is an error, so a new live feature
 * cannot go unmeasured.
 */
export function checkResults(
  verdicts: readonly FeatureVerdict[]
): readonly CheckResult[] {
  return verdicts.map((verdict) => {
    const check = checkOfFeature(verdict.featureUri);
    if (check === null) {
      throw new Error(
        `observability: ${verdict.featureUri} is a live feature with no synthetic check name; add it to SYNTHETIC_CHECKS in libs/observability-shared-ts/src/synthetic-checks.ts`
      );
    }
    return {
      check,
      passed:
        verdict.statuses.length > 0 &&
        verdict.statuses.every((status) => status === 'pass'),
    };
  });
}

/** The `service.name` the Health run reports its checks as. */
export const SYNTHETIC_SERVICE_NAME = technicalName(['health']);

/**
 * The OTLP/JSON request that records one run's results: a gauge point per
 * check at `atMs`, stamped with the environment.
 */
export function checkResultsRequest(input: {
  readonly results: readonly CheckResult[];
  readonly environment: string;
  readonly atMs: number;
  /** The commit the run checked from. */
  readonly version: string;
}): unknown {
  return otlpGaugeRequest({
    contract: SYNTHETIC_CHECK_METRIC,
    service: { name: SYNTHETIC_SERVICE_NAME, version: input.version },
    environment: input.environment,
    atMs: input.atMs,
    readings: input.results.map((result) => ({
      attributes: { [SYNTHETIC_CHECK_DIMENSION]: result.check },
      value: result.passed ? 1 : 0,
    })),
  });
}

/** `…/otlp/v1/traces` (the collector URL the secrets hold) → `…/otlp/v1/metrics`. */
export function metricsEndpoint(collectorUrl: string): string {
  const base = collectorUrl.trim().replace(/\/+$/, '');
  const root = base.replace(/\/v1\/(traces|logs|metrics)$/, '');
  return `${root}/v1/metrics`;
}
