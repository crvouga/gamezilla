/**
 * Record a health run's verdicts as the team's checks from outside: one
 * sample of `synthetic.check.result` per live feature the run selected (1
 * when every scenario it decided passed), sent to the environment's metrics
 * backend over OTLP. The service level objectives count these samples
 * (`libs/observability-shared-ts/src/synthetic-checks.ts`).
 *
 * Recording never changes the run's verdict: a run that cannot record says
 * why, and the objectives' "no events" alert tells the team the checks have
 * gone quiet. Transport, clock and credentials are injected by `health.ts`.
 */

import type { FeatureVerdict } from '@libs/observability-shared-ts/synthetic-checks';
import {
  checkResults,
  checkResultsRequest,
  metricsEndpoint,
} from '@libs/observability-shared-ts/synthetic-checks';
import type { EvidenceRecord } from '@pkgs/conformance-shared-ts/evidence';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import { otlpAuthorization } from '@pkgs/observability-root-shared-ts/otlp-auth';

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
  | { readonly recorded: true; readonly checks: number }
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
  const body = JSON.stringify(
    checkResultsRequest({
      results,
      environment: input.environment,
      atMs: input.nowMs,
      version: input.version,
    })
  );
  let response: Response;
  try {
    response = await input.fetch(metricsEndpoint(url), {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body,
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
  return { recorded: true, checks: results.length };
}
