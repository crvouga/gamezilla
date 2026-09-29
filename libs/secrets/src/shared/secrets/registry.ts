import {
  API_URL,
  LOCAL_PREVIEW_API_ORIGIN,
  VITE_API_URL,
  VITE_COMMIT_DATE,
  VITE_COMMIT_HASH,
} from './api-url';
import {
  AUTH_SECRET,
  SYNTHETIC_MONITOR_TOKEN,
  WEB_CLIENT_GOOGLE_CLIENT_ID,
  WEB_CLIENT_GOOGLE_CLIENT_SECRET,
} from './auth-secrets';
import { BILLING_VENDOR_SECRETS } from './billing-vendor-secrets';
import { CLOUDFLARE_ACCOUNT_ID } from './cf-account-id';
import { CLOUDFLARE_API_TOKEN } from './cf-api-token';
import { DATABASE_URL } from './db-url';
import { HYPERDRIVE_ID } from './hyperdrive-id';
import {
  GITHUB_ADMIN_TOKEN,
  NEON_API_KEY,
  TOFU_STATE_ACCESS_KEY_ID,
  TOFU_STATE_PASSPHRASE,
  TOFU_STATE_SECRET_ACCESS_KEY,
} from './infra-secrets';
import {
  GRAFANA_CLOUD_API_TOKEN,
  OBS_TEMPO_TOKEN,
  OBS_TEMPO_URL,
  OBS_TEMPO_USER,
  OBSERVABILITY_COLLECTOR_TOKEN,
  OBSERVABILITY_COLLECTOR_URL,
  OBSERVABILITY_COLLECTOR_USER,
} from './observability-secrets';
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_API_URL,
  EMQX_DASHBOARD_PASSWORD,
  EMQX_JWT_SECRET,
  EMQX_WSS_URL,
} from './pubsub-emqx-secrets';
import { RAILWAY_TOKEN } from './railway-token';
import { REPORTS_SECRETS } from './reports-credentials';
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
} from './s3-credentials';
import type { Secret } from './secret';
import { ELEVEN_LABS_API_KEY } from './tts-secrets';
import { TURBO_API, TURBO_TOKEN } from './turbo-token';

/**
 * Exhaustive registry of every secret. Keys in the store that are not listed
 * are reported, never deleted (a human-entered value cannot be recovered).
 */
export const SECRETS: readonly Secret[] = [
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID,
  DATABASE_URL,
  HYPERDRIVE_ID,
  AUTH_SECRET,
  SYNTHETIC_MONITOR_TOKEN,
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
  ELEVEN_LABS_API_KEY,
  GRAFANA_CLOUD_API_TOKEN,
  OBSERVABILITY_COLLECTOR_URL,
  OBSERVABILITY_COLLECTOR_USER,
  OBSERVABILITY_COLLECTOR_TOKEN,
  OBS_TEMPO_URL,
  OBS_TEMPO_USER,
  OBS_TEMPO_TOKEN,
  API_URL,
  VITE_API_URL,
  LOCAL_PREVIEW_API_ORIGIN,
  VITE_COMMIT_HASH,
  VITE_COMMIT_DATE,
  RAILWAY_TOKEN,
  EMQX_API_URL,
  EMQX_WSS_URL,
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_JWT_SECRET,
  EMQX_DASHBOARD_PASSWORD,
  TOFU_STATE_PASSPHRASE,
  TOFU_STATE_ACCESS_KEY_ID,
  TOFU_STATE_SECRET_ACCESS_KEY,
  NEON_API_KEY,
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

/** Secrets OpenTofu writes (`libs/infra/tofu/stacks/foundation/secrets.json`). */
export function getTofuManagedSecrets(): readonly Secret[] {
  return SECRETS.filter((s) => s.managedBy === 'tofu');
}
