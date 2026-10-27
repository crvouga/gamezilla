import {
  API_URL,
  LOCAL_PREVIEW_API_ORIGIN,
  VITE_API_URL,
  VITE_COMMIT_DATE,
  VITE_COMMIT_HASH,
} from '@libs/secrets-shared-ts/api-url';
import {
  AUTH_SECRET,
  SYNTHETIC_MONITOR_TOKEN,
  WEB_CLIENT_GOOGLE_CLIENT_ID,
  WEB_CLIENT_GOOGLE_CLIENT_SECRET,
} from '@libs/secrets-shared-ts/auth-secrets';
import { CLOUDFLARE_ACCOUNT_ID } from '@libs/secrets-shared-ts/cf-account-id';
import { CLOUDFLARE_API_TOKEN } from '@libs/secrets-shared-ts/cf-api-token';
import { CI_ARTIFACTS_SECRETS } from '@libs/secrets-shared-ts/ci-artifacts-credentials';
import {
  FEEDBACK_GITHUB_REPOSITORY,
  FEEDBACK_GITHUB_TOKEN,
} from '@libs/secrets-shared-ts/feedback-secrets';
import { HYPERDRIVE_ID } from '@libs/secrets-shared-ts/hyperdrive-id';
import {
  GITHUB_ADMIN_TOKEN,
  PLANETSCALE_SERVICE_TOKEN,
  PLANETSCALE_SERVICE_TOKEN_ID,
  TOFU_STATE_ACCESS_KEY_ID,
  TOFU_STATE_PASSPHRASE,
  TOFU_STATE_SECRET_ACCESS_KEY,
} from '@libs/secrets-shared-ts/infra-secrets';
import {
  EMQX_JWT_SECRET,
  EMQX_WSS_URL,
} from '@libs/secrets-shared-ts/pubsub-emqx-secrets';
import { IOT_SECRETS } from '@libs/secrets-shared-ts/pubsub-iot-secrets';
import { RAILWAY_TOKEN } from '@libs/secrets-shared-ts/railway-token';
import { REPORTS_SECRETS } from '@libs/secrets-shared-ts/reports-credentials';
import type { Secret } from '@libs/secrets-shared-ts/secret';
import { SHARED_DATA_SECRETS } from '@libs/secrets-shared-ts/shared-data-credentials';
import { POPULATION_WORKER_TOKEN } from '@libs/secrets-shared-ts/synthetic-population-secrets';
import { ELEVEN_LABS_API_KEY } from '@libs/secrets-shared-ts/tts-secrets';
import { TURBO_API, TURBO_TOKEN } from '@libs/secrets-shared-ts/turbo-token';
import { BILLING_VENDOR_SECRETS } from './billing-vendor-secrets';
import { DATABASE_URL } from './db-url';
import {
  GRAFANA_CLOUD_API_TOKEN,
  OBS_LOKI_URL,
  OBS_LOKI_USER,
  OBS_PROMETHEUS_URL,
  OBS_PROMETHEUS_USER,
  OBS_READONLY_DATABASE_URL,
  OBS_TEMPO_TOKEN,
  OBS_TEMPO_URL,
  OBS_TEMPO_USER,
  OBSERVABILITY_COLLECTOR_TOKEN,
  OBSERVABILITY_COLLECTOR_URL,
  OBSERVABILITY_COLLECTOR_USER,
  OBSERVABILITY_LOGS_URL,
  OBSERVABILITY_METRICS_URL,
} from './observability-secrets';
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
} from './s3-credentials';

/**
 * Exhaustive registry of every secret. Keys in the store that are not listed
 * are reported, never deleted (a human-entered value cannot be recovered).
 */
export const SECRETS: readonly Secret[] = [
  FEEDBACK_GITHUB_TOKEN,
  FEEDBACK_GITHUB_REPOSITORY,
  CLOUDFLARE_API_TOKEN,
  RAILWAY_TOKEN,
  CLOUDFLARE_ACCOUNT_ID,
  DATABASE_URL,
  HYPERDRIVE_ID,
  AUTH_SECRET,
  SYNTHETIC_MONITOR_TOKEN,
  POPULATION_WORKER_TOKEN,
  WEB_CLIENT_GOOGLE_CLIENT_ID,
  WEB_CLIENT_GOOGLE_CLIENT_SECRET,
  ...BILLING_VENDOR_SECRETS,
  TURBO_API,
  TURBO_TOKEN,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_REGION,
  ...REPORTS_SECRETS,
  ...SHARED_DATA_SECRETS,
  ...CI_ARTIFACTS_SECRETS,
  ELEVEN_LABS_API_KEY,
  GRAFANA_CLOUD_API_TOKEN,
  OBSERVABILITY_COLLECTOR_URL,
  OBSERVABILITY_COLLECTOR_USER,
  OBSERVABILITY_LOGS_URL,
  OBSERVABILITY_METRICS_URL,
  OBSERVABILITY_COLLECTOR_TOKEN,
  OBS_TEMPO_URL,
  OBS_TEMPO_USER,
  OBS_TEMPO_TOKEN,
  OBS_LOKI_URL,
  OBS_LOKI_USER,
  OBS_PROMETHEUS_URL,
  OBS_PROMETHEUS_USER,
  OBS_READONLY_DATABASE_URL,
  API_URL,
  VITE_API_URL,
  LOCAL_PREVIEW_API_ORIGIN,
  VITE_COMMIT_HASH,
  VITE_COMMIT_DATE,
  EMQX_WSS_URL,
  EMQX_JWT_SECRET,
  ...IOT_SECRETS,
  TOFU_STATE_PASSPHRASE,
  TOFU_STATE_ACCESS_KEY_ID,
  TOFU_STATE_SECRET_ACCESS_KEY,
  PLANETSCALE_SERVICE_TOKEN_ID,
  PLANETSCALE_SERVICE_TOKEN,
  GITHUB_ADMIN_TOKEN,
];

export function getSecretMap(): readonly Secret[] {
  return SECRETS;
}

export function getRegistrySecretNames(): ReadonlySet<string> {
  return new Set(SECRETS.map((s) => s.name));
}

export function getApiWorkerSecrets(): readonly Secret[] {
  return SECRETS.filter((s) => s.pushToApiWorker);
}

/** Secrets OpenTofu writes (`libs/infra-shared-ts/tofu/stacks/foundation/secrets.json`). */
export function getTofuManagedSecrets(): readonly Secret[] {
  return SECRETS.filter((s) => s.managedBy === 'tofu');
}
