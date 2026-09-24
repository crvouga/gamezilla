import { ObservabilitySecretName as Name } from '@libs/observability/public/secret-names';
import {
  requireHttpsUrl,
  requireNonEmpty,
  Secret,
  type SecretInput,
} from './secret';

const PROVISIONER = '@libs/observability#provision';
const PROVISIONED = `Seeded by \`${PROVISIONER}\` from GRAFANA_CLOUD_API_TOKEN.`;

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
  if (input.env === 'prd' && url.protocol !== 'https:') {
    throw new Error(`${Name.collectorUrl} must use https:// in prd`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${Name.collectorUrl} must use http:// or https://`);
  }
}

async function validateNonEmpty(input: SecretInput, name: string) {
  requireNonEmpty(input.secretValue, name);
}

export const GRAFANA_CLOUD_API_TOKEN = new Secret({
  name: Name.grafanaCloudApiToken,
  hint: [
    'https://grafana.com/orgs/<org>/access-policies → Create access policy',
    'Realm: your org. Scopes: stacks:read, stacks:write, accesspolicies:read,',
    'accesspolicies:write, accesspolicies:delete. Then "Add token" and paste it.',
    'Provision-only bootstrap credential; never pushed to a Worker.',
  ].join('\n'),
  optional: true,
  validate: (i) => validateNonEmpty(i, Name.grafanaCloudApiToken),
});

export const OBSERVABILITY_COLLECTOR_URL = new Secret({
  name: Name.collectorUrl,
  hint: `Grafana Cloud OTLP gateway …/otlp/v1/traces. ${PROVISIONED}`,
  optional: true,
  provisionedBy: PROVISIONER,
  pushToApiWorker: true,
  validate: validateCollectorUrl,
});

export const OBSERVABILITY_COLLECTOR_USER = new Secret({
  name: Name.collectorUser,
  hint: `Grafana Cloud stack id (OTLP Basic-auth user). ${PROVISIONED}`,
  optional: true,
  provisionedBy: PROVISIONER,
  pushToApiWorker: true,
  validate: (i) => validateNonEmpty(i, Name.collectorUser),
});

export const OBSERVABILITY_COLLECTOR_TOKEN = new Secret({
  name: Name.collectorToken,
  hint: `Write-only traces:write token for OTLP ingest. ${PROVISIONED}`,
  optional: true,
  provisionedBy: PROVISIONER,
  pushToApiWorker: true,
  validate: (i) => validateNonEmpty(i, Name.collectorToken),
});

export const OBS_TEMPO_URL = new Secret({
  name: Name.tempoUrl,
  hint: `Tempo query origin for \`bun obs --source prod\`. ${PROVISIONED}`,
  optional: true,
  provisionedBy: PROVISIONER,
  validate: async (i) => requireHttpsUrl(i.secretValue, Name.tempoUrl),
});

export const OBS_TEMPO_USER = new Secret({
  name: Name.tempoUser,
  hint: `Grafana Cloud Tempo instance id (query Basic-auth user). ${PROVISIONED}`,
  optional: true,
  provisionedBy: PROVISIONER,
  validate: (i) => validateNonEmpty(i, Name.tempoUser),
});

export const OBS_TEMPO_TOKEN = new Secret({
  name: Name.tempoToken,
  hint: `Read-only traces:read token for agent queries. ${PROVISIONED}`,
  optional: true,
  provisionedBy: PROVISIONER,
  validate: (i) => validateNonEmpty(i, Name.tempoToken),
});
