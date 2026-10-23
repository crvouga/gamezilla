// @io-wall-ok — live health: Grafana Cloud OTLP ingest and Tempo query.
/** `specs/runtime/request-records.feature` (skipped with `OBSERVABILITY_ENABLED=0`). */

import { expect } from 'bun:test';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import { workerName } from '@libs/infra-shared-ts/wrangler';
import {
  appTraceIsReadable,
  requestAppTrace,
} from '@libs/observability-server-ts/app-trace-probe';
import {
  probeIngest,
  probeQuery,
} from '@libs/observability-server-ts/grafana-probes';
import {
  backgroundWork,
  newestTrailAgeMs,
  signedInRequests,
  trailEnvironments,
  unknownEnvironments,
} from '@libs/observability-server-ts/trail-probes';
import { ObservabilitySecretName as Name } from '@libs/observability-shared-ts/secret-names';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { readCloudflareErrors } from '@pkgs/observability-cli-shared-ts/cloudflare-errors';
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

/** The scheduled drain runs every minute; five missed ones is a stopped trail. */
const TRAIL_STALE_MS = 5 * 60 * 1000;
/** Short, so records written before the last deploy do not decide it. */
const RECENT_MS = 5 * 60 * 1000;

function trailAccess() {
  return {
    tempoUrl: foundationSecret(Name.tempoUrl),
    tempoUser: foundationSecret(Name.tempoUser),
    tempoToken: foundationSecret(Name.tempoToken),
  };
}

/** The app writes the trail on its own clock, so silence means it stopped. */
Then('the trail is up to date', async (w) => {
  let ageMs: number | null = null;
  const fresh = await eventually(
    async () => {
      ageMs = await newestTrailAgeMs(w.http, trailAccess(), {
        environment: w.env.env,
        nowMs: wallClock.now(),
        lookbackMs: TRAIL_STALE_MS,
      });
      return ageMs !== null;
    },
    { maxWaitMs: TOKEN_WARMUP_MS, retryMs: RETRY_MS, ...wallWait }
  );
  expect(
    fresh,
    `nothing was written to the trail for ${w.env.env} in the last ${String(TRAIL_STALE_MS / 60_000)} minutes`
  ).toBe(true);
});

/** A record under a name no environment owns is missed by every query that names one. */
Then(
  'every record in the trail comes from an environment of the app',
  async (w) => {
    const deployed = Object.values(ENV_FILES).map((file) => file.env);
    const found = await trailEnvironments(w.http, trailAccess(), {
      nowMs: wallClock.now(),
      lookbackMs: RECENT_MS,
    });
    expect(
      unknownEnvironments(found, deployed),
      'records name an environment no deployment owns'
    ).toEqual([]);
  }
);

/** Without it the team cannot go from a person to what happened to them. */
Then('a request that needs an account says whose it was', async (w) => {
  const seen = await signedInRequests(w.http, trailAccess(), {
    environment: w.env.env,
    nowMs: wallClock.now(),
    lookbackMs: RECENT_MS,
  });
  if (seen.answered === 0) return;
  expect(
    seen.nameless,
    `${String(seen.nameless)} of ${String(seen.answered)} recent requests that need an account do not say whose they were`
  ).toBe(0);
});

/** A few runs, short enough that a fix just deployed is judged by its own. */
const WORK_WINDOW_MS = 3 * 60 * 1000;
/** Contention happens; a drain failing one run in four is something else. */
const WORK_FAILURE_LIMIT = 0.25;

/** The drain delivers everything the app does after answering a person. */
Then('the app finishes the work it does after answering people', async (w) => {
  let seen = { runs: 0, failed: 0 };
  const succeeded = await eventually(
    async () => {
      seen = await backgroundWork(w.http, trailAccess(), {
        environment: w.env.env,
        nowMs: wallClock.now(),
        lookbackMs: WORK_WINDOW_MS,
      });
      return seen.runs > 0 && seen.failed / seen.runs <= WORK_FAILURE_LIMIT;
    },
    {
      maxWaitMs: TOKEN_WARMUP_MS + WORK_WINDOW_MS,
      retryMs: RETRY_MS,
      ...wallWait,
    }
  );
  expect(
    succeeded,
    `${String(seen.failed)} of ${String(seen.runs)} scheduled outbox drains in the last ${String(WORK_WINDOW_MS / 60_000)} minutes failed`
  ).toBe(true);
});
