import {
  API_URL,
  LOCAL_PREVIEW_API_ORIGIN,
  VITE_API_URL,
  VITE_COMMIT_DATE,
  VITE_COMMIT_HASH,
} from './api-url';
import {
  AUTH_SECRET,
  WEB_CLIENT_GOOGLE_CLIENT_ID,
  WEB_CLIENT_GOOGLE_CLIENT_SECRET,
} from './auth-secrets';
import { BILLING_VENDOR_SECRETS } from './billing-vendor-secrets';
import { CLOUDFLARE_ACCOUNT_ID } from './cf-account-id';
import { CLOUDFLARE_API_TOKEN } from './cf-api-token';
import { DATABASE_URL } from './db-url';
import {
  ELEVEN_LABS_API_KEY,
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
} from './llm-tts-secrets';
import {
  OBSERVABILITY_COLLECTOR_TOKEN,
  OBSERVABILITY_COLLECTOR_URL,
} from './observability-secrets';
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_API_URL,
  EMQX_JWT_SECRET,
  EMQX_WSS_URL,
} from './pubsub-emqx-secrets';
import { RAILWAY_TOKEN } from './railway-token';
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
} from './s3-credentials';
import type { Secret } from './secret';
import { TURBO_API, TURBO_TOKEN } from './turbo-token';

/**
 * Exhaustive registry of every managed secret. Orphans (stored keys not in
 * this list) are purged on provision; `check:secrets` allows them.
 */
export const SECRETS: readonly Secret[] = [
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID,
  DATABASE_URL,
  AUTH_SECRET,
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
  ELEVEN_LABS_API_KEY,
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  OBSERVABILITY_COLLECTOR_URL,
  OBSERVABILITY_COLLECTOR_TOKEN,
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

export function getMirrorToDevSecrets(): readonly Secret[] {
  return SECRETS.filter((s) => s.mirrorToDev);
}

export function getSeedableSecrets(): readonly Secret[] {
  return SECRETS.filter((s) => s.seed !== undefined);
}

export function getSeedInAllEnvsSecrets(): readonly Secret[] {
  return SECRETS.filter((s) => s.seedInAllEnvs && s.seed !== undefined);
}
