import { requireNonEmpty, Secret, type SecretInput } from './secret';

async function validateCollectorUrl(input: SecretInput): Promise<void> {
  const value = input.secretValue.trim();
  requireNonEmpty(value, 'OBSERVABILITY_COLLECTOR_URL');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('OBSERVABILITY_COLLECTOR_URL must be a valid URL');
  }
  if (url.pathname !== '/v1/traces') {
    throw new Error(
      'OBSERVABILITY_COLLECTOR_URL must be the exact OTLP HTTP /v1/traces endpoint'
    );
  }
  if (input.env === 'prd' && url.protocol !== 'https:') {
    throw new Error('OBSERVABILITY_COLLECTOR_URL must use https:// in prd');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('OBSERVABILITY_COLLECTOR_URL must use http:// or https://');
  }
}

export const OBSERVABILITY_COLLECTOR_URL = new Secret({
  name: 'OBSERVABILITY_COLLECTOR_URL',
  hint: 'Exact OTLP/HTTP trace ingest endpoint ending in /v1/traces',
  optional: true,
  pushToApiWorker: true,
  validate: validateCollectorUrl,
});

export const OBSERVABILITY_COLLECTOR_TOKEN = new Secret({
  name: 'OBSERVABILITY_COLLECTOR_TOKEN',
  hint: 'Write-only bearer token for OTLP trace ingest',
  optional: true,
  pushToApiWorker: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'OBSERVABILITY_COLLECTOR_TOKEN');
  },
});
