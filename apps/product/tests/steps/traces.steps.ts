// @io-wall-ok — live health: Grafana Cloud OTLP ingest and Tempo query.
/** `specs/runtime/request-records.feature` (skipped with `OBSERVABILITY_ENABLED=0`). */

import { expect } from 'bun:test';
import { workerName } from '@libs/infra-shared/wrangler';
import {
  appTraceIsReadable,
  requestAppTrace,
} from '@libs/observability-server/app-trace-probe';
import {
  probeIngest,
  probeQuery,
} from '@libs/observability-server/grafana-probes';
import { ObservabilitySecretName as Name } from '@libs/observability-shared/secret-names';
import { wallClock } from '@pkgs/clock-shared/wall';
import { readCloudflareErrors } from '@pkgs/observability-cli-shared/cloudflare-errors';
import { eventually, Then } from './define';
import { requireSecret } from './live-world';
import { wallWait } from './wall-wait';

/** Tokens OpenTofu just minted take a moment to authenticate everywhere. */
const TOKEN_WARMUP_MS = 3 * 60 * 1000;
const RETRY_MS = 10_000;

function foundationSecret(name: string): string {
  try {
    return requireSecret(name);
  } catch (cause) {
    throw new Error(`${name} missing — run @libs/infra#apply:foundation`, {
      cause,
    });
  }
}

/** The Workers send traces to the Grafana OTLP gateway, with a write token it accepts. */
Then('the app leaves a trail of what it does for people', async (w) => {
  const url = new URL(foundationSecret(Name.collectorUrl));
  expect(url.protocol).toBe('https:');
  expect(url.pathname).toEndWith('/otlp/v1/traces');
  const ok = await eventually(
    () =>
      probeIngest(
        w.http,
        foundationSecret(Name.collectorUrl),
        foundationSecret(Name.collectorUser),
        foundationSecret(Name.collectorToken)
      ),
    { maxWaitMs: TOKEN_WARMUP_MS, retryMs: RETRY_MS, ...wallWait }
  );
  expect(ok, 'OTLP ingest rejected the write token').toBe(true);
});

/** The agents' read token can query Tempo. */
Then(
  'the team can follow the trail of what the app did for someone',
  async (w) => {
    const ok = await eventually(
      () =>
        probeQuery(
          w.http,
          foundationSecret(Name.tempoUrl),
          foundationSecret(Name.tempoUser),
          foundationSecret(Name.tempoToken)
        ),
      { maxWaitMs: TOKEN_WARMUP_MS, retryMs: RETRY_MS, ...wallWait }
    );
    expect(ok, 'Tempo rejected the read token').toBe(true);
    const nowMs = wallClock.now();
    const platform = await readCloudflareErrors({
      http: w.http,
      accountId: requireSecret('CLOUDFLARE_ACCOUNT_ID'),
      token: requireSecret('CLOUDFLARE_API_TOKEN'),
      service: workerName(w.env),
      range: { startMs: nowMs - 60_000, endMs: nowMs },
      signal: AbortSignal.timeout(15_000),
    });
    expect(
      Number.isFinite(platform.count),
      'retained platform errors are inaccessible'
    ).toBe(true);
    const probe = {
      traceId: crypto.randomUUID().replaceAll('-', ''),
      spanId: crypto.randomUUID().replaceAll('-', '').slice(0, 16),
    };
    expect(
      await requestAppTrace(w.http, w.origins.api, probe),
      'the app could not answer the trace probe'
    ).toBe(true);
    const readable = await eventually(
      () =>
        appTraceIsReadable(w.http, {
          probe,
          tempoUrl: foundationSecret(Name.tempoUrl),
          tempoUser: foundationSecret(Name.tempoUser),
          tempoToken: foundationSecret(Name.tempoToken),
          nowMs: wallClock.now(),
        }),
      { maxWaitMs: TOKEN_WARMUP_MS, retryMs: RETRY_MS, ...wallWait }
    );
    expect(
      readable,
      'the real app handled the request but its trace never became readable'
    ).toBe(true);
  }
);
