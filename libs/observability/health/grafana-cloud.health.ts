// @io-wall-ok — live health probe (Grafana Cloud OTLP ingest + Tempo query).
import { describe, expect, test } from 'bun:test';
import { ObservabilitySecretName as Name } from '@libs/observability/public/secret-names';
import {
  probeIngest,
  probeQuery,
} from '@libs/observability/server/ensure-grafana-cloud-traces';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';

const http = createGlobalHttpClient();
const prd = isProductionSecretsEnv();
const disabled = (process.env['OBSERVABILITY_ENABLED'] ?? '').trim() === '0';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  expect(value, `${name} missing — run @libs/observability#provision`).not.toBe(
    ''
  );
  return value;
}

describe.skipIf(!prd || disabled)('grafana cloud traces (prd)', () => {
  test('ingest endpoint is the Grafana OTLP gateway', () => {
    const url = new URL(requireEnv(Name.collectorUrl));
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toEndWith('/otlp/v1/traces');
  });

  test('Workers’ write token can ingest traces', async () => {
    const ok = await probeIngest(
      http,
      requireEnv(Name.collectorUrl),
      requireEnv(Name.collectorUser),
      requireEnv(Name.collectorToken)
    );
    expect(ok, 'OTLP ingest rejected the write token').toBe(true);
  });

  test('agents’ read token can query Tempo', async () => {
    const ok = await probeQuery(
      http,
      requireEnv(Name.tempoUrl),
      requireEnv(Name.tempoUser),
      requireEnv(Name.tempoToken)
    );
    expect(ok, 'Tempo rejected the read token').toBe(true);
  });
});
