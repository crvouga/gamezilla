/**
 * Record a health run's verdicts as the team's checks from outside: one
 * sample of `synthetic.check.result` per live feature the run selected (1
 * when every scenario it decided passed), sent to the environment's metrics
 * backend over OTLP. The service level objectives count these samples
 * (`libs/observability-server-ts/src/synthetic-checks.ts`).
 *
 * A run whose results cannot be recorded, or never become queryable, fails:
 * the objectives would otherwise be judged without them while nothing
 * alerts. Transport, clock and credentials are injected by `health.ts`.
 */

import {
  emittedMetric,
  labelOf,
} from '@libs/observability-server-ts/emitted-metrics';
import type { FeatureVerdict } from '@libs/observability-server-ts/synthetic-checks';
import {
  checkResults,
  checkResultsRequest,
  metricsEndpoint,
  SYNTHETIC_CHECK_DIMENSION,
  SYNTHETIC_CHECK_METRIC,
} from '@libs/observability-server-ts/synthetic-checks';
import type { EvidenceRecord } from '@pkgs/conformance-shared-ts/evidence';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import { otlpAuthorization } from '@pkgs/observability-root-shared-ts/otlp-auth';
import type { PrometheusClient } from '@pkgs/observability-root-shared-ts/prometheus';

/** The secrets that let a run write to the environment's metrics backend. */
const COLLECTOR = {
  url: 'OBSERVABILITY_COLLECTOR_URL',
  user: 'OBSERVABILITY_COLLECTOR_USER',
  token: 'OBSERVABILITY_COLLECTOR_TOKEN',
} as const;

/** Each selected feature's decided scenario statuses, from the run's evidence. */
export function featureVerdicts(input: {
  readonly featureUris: readonly string[];
  readonly records: readonly EvidenceRecord[];
}): readonly FeatureVerdict[] {
  return input.featureUris.map((featureUri) => ({
    featureUri,
    statuses: input.records
      .filter((record) => record.specUri === featureUri)
      .flatMap((record) => record.obligations.map((o) => o.status)),
  }));
}

export type RecordOutcome =
  | {
      readonly recorded: true;
      readonly checks: number;
      /** The check names written, to read back. */
      readonly names: readonly string[];
    }
  | { readonly recorded: false; readonly reason: string };

export async function recordCheckResults(input: {
  readonly verdicts: readonly FeatureVerdict[];
  readonly environment: string;
  readonly version: string;
  readonly secrets: ReadonlyMap<string, string>;
  readonly fetch: HttpFetch;
  readonly nowMs: number;
}): Promise<RecordOutcome> {
  const results = checkResults(input.verdicts);
  if (results.length === 0) {
    return { recorded: false, reason: 'the run selected no live feature' };
  }
  const body = JSON.stringify(
    checkResultsRequest({
      results,
      environment: input.environment,
      atMs: input.nowMs,
      version: input.version,
    })
  );
  const sent = await sendMetrics({
    body,
    secrets: input.secrets,
    fetch: input.fetch,
  });
  if (!sent.recorded) return sent;
  return {
    recorded: true,
    checks: results.length,
    names: results.map((result) => result.check),
  };
}

/**
 * POST one OTLP/JSON metrics request to the environment's metrics backend,
 * with the collector credentials its secrets hold. Never throws: an outcome
 * that did not record says why.
 */
export async function sendMetrics(input: {
  readonly body: string;
  readonly secrets: ReadonlyMap<string, string>;
  readonly fetch: HttpFetch;
}): Promise<
  | { readonly recorded: true }
  | { readonly recorded: false; readonly reason: string }
> {
  const url = input.secrets.get(COLLECTOR.url)?.trim() ?? '';
  const authorization = otlpAuthorization({
    user: input.secrets.get(COLLECTOR.user),
    token: input.secrets.get(COLLECTOR.token),
  });
  if (url === '' || authorization === undefined) {
    return {
      recorded: false,
      reason: `${COLLECTOR.url} and ${COLLECTOR.token} must be set in the environment's secrets`,
    };
  }
  let response: Response;
  try {
    response = await input.fetch(metricsEndpoint(url), {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: input.body,
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return {
      recorded: false,
      reason: `the metrics backend did not answer (${reason})`,
    };
  }
  const text = await response.text();
  if (!response.ok) {
    return {
      recorded: false,
      reason: `the metrics backend answered ${String(response.status)}: ${text.slice(0, 240)}`,
    };
  }
  // OTLP answers 200 with a partial rejection when it refused some points.
  if (/"rejectedDataPoints"\s*:\s*"?[1-9]/.test(text)) {
    return {
      recorded: false,
      reason: `the metrics backend refused some samples: ${text.slice(0, 240)}`,
    };
  }
  return { recorded: true };
}

/** How long after a write its samples may take to become queryable. */
const CONFIRM_ATTEMPTS = 12;
const CONFIRM_INTERVAL_MS = 15_000;

export type ConfirmOutcome =
  | { readonly confirmed: true }
  | { readonly confirmed: false; readonly reason: string };

/**
 * Read back what a run recorded. The metrics gateway acknowledges a write
 * before storing it, and drops it later when the stack is at its
 * active-series limit, so an acknowledged write is not evidence. Every
 * recorded check must be queryable for this run's version, or the
 * objectives are judged without it and no alert can mean the app works.
 */
export async function confirmCheckResults(input: {
  readonly checks: readonly string[];
  readonly environment: string;
  readonly version: string;
  readonly prometheus: PrometheusClient;
  readonly now: () => number;
  readonly wait: (ms: number) => Promise<void>;
}): Promise<ConfirmOutcome> {
  const metric = emittedMetric(SYNTHETIC_CHECK_METRIC.name);
  if (metric.series.kind !== 'gauge')
    throw new Error('health: synthetic.check.result is not a gauge');
  const check = labelOf(SYNTHETIC_CHECK_DIMENSION);
  const query = `count by (${check})(count_over_time(${metric.series.value}{deployment_environment_name=${JSON.stringify(input.environment)},service_version=${JSON.stringify(input.version)}}[30m]))`;
  let missing: readonly string[] = input.checks;
  for (let attempt = 1; attempt <= CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      const found = new Set(
        (await input.prometheus.instant(query, input.now())).map(
          (sample) => sample.labels[check] ?? ''
        )
      );
      missing = input.checks.filter((name) => !found.has(name));
      if (missing.length === 0) return { confirmed: true };
    } catch (error) {
      if (attempt === CONFIRM_ATTEMPTS)
        return {
          confirmed: false,
          reason: `the metrics backend could not be read: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    if (attempt < CONFIRM_ATTEMPTS) await input.wait(CONFIRM_INTERVAL_MS);
  }
  return {
    confirmed: false,
    reason: `${String(missing.length)} of ${String(input.checks.length)} recorded checks never became queryable (${missing.join(', ')}); the metrics backend likely refused them at its active-series limit`,
  };
}
