// @io-wall-ok — live health: Grafana Cloud OTLP ingest and Tempo query.
/** `specs/health/traces.feature` (skipped with `OBSERVABILITY_ENABLED=0`). */

import { expect } from 'bun:test';
import { ObservabilitySecretName as Name } from '@libs/observability/public/secret-names';
import {
  probeIngest,
  probeQuery,
} from '@libs/observability/server/grafana-probes';
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

Then('the trace ingest address is the Grafana OTLP gateway', () => {
  const url = new URL(foundationSecret(Name.collectorUrl));
  expect(url.protocol).toBe('https:');
  expect(url.pathname).toEndWith('/otlp/v1/traces');
});

Then("the Workers' write token can ingest traces", async (w) => {
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

Then("the agents' read token can query Tempo", async (w) => {
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
});
