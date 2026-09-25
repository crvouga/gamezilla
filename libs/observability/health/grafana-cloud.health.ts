// @io-wall-ok — live health probe (Grafana Cloud OTLP ingest + Tempo query).
import { describe, expect, test } from 'bun:test';
import { ObservabilitySecretName as Name } from '@libs/observability/public/secret-names';
import {
  probeIngest,
  probeQuery,
} from '@libs/observability/server/grafana-probes';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client';

const http = createGlobalHttpClient();

/** Tokens OpenTofu just minted take a moment to authenticate everywhere. */
const WARMUP_MS = 3 * 60 * 1000;

async function eventually(probe: () => Promise<boolean>): Promise<boolean> {
  const deadline = wallClock.now() + WARMUP_MS;
  for (;;) {
    if (await probe()) return true;
    if (wallClock.now() >= deadline) return false;
    await new Promise<void>((resolve) => {
      wallTimers.setTimeout(() => resolve(), 10_000);
    });
  }
}
const disabled = (process.env['OBSERVABILITY_ENABLED'] ?? '').trim() === '0';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  expect(value, `${name} missing — run @libs/infra#apply:foundation`).not.toBe(
    ''
  );
  return value;
}

describe.skipIf(disabled)('grafana cloud traces', () => {
  test('ingest endpoint is the Grafana OTLP gateway', () => {
    const url = new URL(requireEnv(Name.collectorUrl));
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toEndWith('/otlp/v1/traces');
  });

  test(
    'Workers’ write token can ingest traces',
    async () => {
      const ok = await eventually(() =>
        probeIngest(
          http,
          requireEnv(Name.collectorUrl),
          requireEnv(Name.collectorUser),
          requireEnv(Name.collectorToken)
        )
      );
      expect(ok, 'OTLP ingest rejected the write token').toBe(true);
    },
    WARMUP_MS + 60_000
  );

  test(
    'agents’ read token can query Tempo',
    async () => {
      const ok = await eventually(() =>
        probeQuery(
          http,
          requireEnv(Name.tempoUrl),
          requireEnv(Name.tempoUser),
          requireEnv(Name.tempoToken)
        )
      );
      expect(ok, 'Tempo rejected the read token').toBe(true);
    },
    WARMUP_MS + 60_000
  );
});
