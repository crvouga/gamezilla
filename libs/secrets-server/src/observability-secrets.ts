import { isProductionEnv } from '@libs/infra-shared/env-file';
import { ObservabilitySecretName as Name } from '@libs/observability-shared/secret-names';
import type { SecretInput } from '@libs/secrets-shared/secret';
import {
  requireHttpsUrl,
  requireNonEmpty,
  Secret,
} from '@libs/secrets-shared/secret';
import { validateReadonlyDatabaseUrl } from './db-url';

const PROVISIONED = 'Written by `@libs/infra#apply:foundation` (OpenTofu).';

async function validateCollectorUrl(input: SecretInput): Promise<void> {
  const value = input.secretValue.trim();
  requireNonEmpty(value, Name.collectorUrl);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${Name.collectorUrl} must be a valid URL`);
  }
  if (!url.pathname.endsWith('/v1/traces')) {
    throw new Error(
      `${Name.collectorUrl} must be an OTLP HTTP endpoint ending in /v1/traces`
    );
  }
  if (isProductionEnv(input.env) && url.protocol !== 'https:') {
    throw new Error(`${Name.collectorUrl} must use https:// in production`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${Name.collectorUrl} must use http:// or https://`);
  }
}

async function validateNonEmpty(input: SecretInput, name: string) {
  requireNonEmpty(input.secretValue, name);
}

function signalEndpoint(name: string, signal: 'logs' | 'metrics') {
  return new Secret({
    name,
    optional: true,
    managedBy: 'tofu',
    pushToApiWorker: true,
    hint: `Exact OTLP HTTP ${signal} endpoint. ${PROVISIONED}`,
    async validate(input) {
      const url = new URL(input.secretValue.trim());
      if (
        !url.pathname.endsWith(`/v1/${signal}`) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !['http:', 'https:'].includes(url.protocol)
      )
        throw new Error(`Invalid ${signal} endpoint`);
      if (isProductionEnv(input.env)) requireHttpsUrl(input.secretValue, name);
    },
  });
}

export const OBSERVABILITY_LOGS_URL = signalEndpoint(Name.logsUrl, 'logs');
export const OBSERVABILITY_METRICS_URL = signalEndpoint(
  Name.metricsUrl,
  'metrics'
);

export const GRAFANA_CLOUD_API_TOKEN = new Secret({
  name: Name.grafanaCloudApiToken,
  hint: [
    'https://grafana.com/orgs/<org>/access-policies → Create access policy',
    'Realm: your org. Scopes: stacks:read, stacks:write, accesspolicies:read,',
    'accesspolicies:write, accesspolicies:delete. Then "Add token" and paste it.',
    'OpenTofu Grafana provider credential; never pushed to a Worker.',
  ].join('\n'),
  validate: (i) => validateNonEmpty(i, Name.grafanaCloudApiToken),
});

export const OBSERVABILITY_COLLECTOR_URL = new Secret({
  name: Name.collectorUrl,
  hint: `Grafana Cloud OTLP gateway …/otlp/v1/traces. ${PROVISIONED}`,
  optional: true,
  managedBy: 'tofu',
  pushToApiWorker: true,
  validate: validateCollectorUrl,
});

export const OBSERVABILITY_COLLECTOR_USER = new Secret({
  name: Name.collectorUser,
  hint: `Grafana Cloud stack id (OTLP Basic-auth user). ${PROVISIONED}`,
  optional: true,
  managedBy: 'tofu',
  pushToApiWorker: true,
  validate: (i) => validateNonEmpty(i, Name.collectorUser),
});

export const OBSERVABILITY_COLLECTOR_TOKEN = new Secret({
  name: Name.collectorToken,
  hint: `Write-only traces, logs and metrics token for the shared Grafana OTLP ingest. ${PROVISIONED}`,
  optional: true,
  managedBy: 'tofu',
  pushToApiWorker: true,
  validate: (i) => validateNonEmpty(i, Name.collectorToken),
});

export const OBS_TEMPO_URL = new Secret({
  name: Name.tempoUrl,
  hint: `Tempo query origin for \`bun obs --source prod\`. ${PROVISIONED}`,
  optional: true,
  managedBy: 'tofu',
  validate: async (i) => requireHttpsUrl(i.secretValue, Name.tempoUrl),
});

export const OBS_TEMPO_USER = new Secret({
  name: Name.tempoUser,
  hint: `Grafana Cloud Tempo instance id (query Basic-auth user). ${PROVISIONED}`,
  optional: true,
  managedBy: 'tofu',
  validate: (i) => validateNonEmpty(i, Name.tempoUser),
});

export const OBS_TEMPO_TOKEN = new Secret({
  name: Name.tempoToken,
  hint: `Read-only traces:read token for agent queries. ${PROVISIONED}`,
  optional: true,
  managedBy: 'tofu',
  validate: (i) => validateNonEmpty(i, Name.tempoToken),
});

export const OBS_READONLY_DATABASE_URL = new Secret({
  name: Name.readonlyDatabaseUrl,
  hint: `SELECT-only URL for resolving a person's name. The Neki role is obs_read. ${PROVISIONED}`,
  optional: true,
  managedBy: 'tofu',
  validate: validateReadonlyDatabaseUrl,
});
