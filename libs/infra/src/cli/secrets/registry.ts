import {
  API_URL,
  EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_COMMIT_DATE,
  EXPO_PUBLIC_COMMIT_HASH,
  LOCAL_PREVIEW_API_ORIGIN,
} from './api-url';
import {
  AUTH_PUBLISHABLE_KEY,
  AUTH_SECRET_KEY,
  EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY,
} from './auth-secrets';
import { B2_MASTER_KEY, B2_MASTER_KEY_ID } from './b2-credentials';
import { CLOUDFLARE_ACCOUNT_ID } from './cf-account-id';
import { CLOUDFLARE_API_TOKEN } from './cf-api-token';
import { CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY } from './clerk-alias-secrets';
import { DATABASE_URL } from './db-url';
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_API_URL,
  EMQX_JWT_SECRET,
  EMQX_WSS_URL,
} from './emqx-secrets';
import { EXPO_TOKEN } from './expo-token';
import {
  ELEVEN_LABS_API_KEY,
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
} from './llm-tts-secrets';
import {
  EXPO_PUBLIC_OBSERVABILITY_BACKEND,
  EXPO_PUBLIC_SENTRY_DSN,
  OBSERVABILITY_BACKEND,
  SENTRY_DSN,
} from './observability-secrets';
import { RAILWAY_TOKEN } from './railway-token';
import {
  B2_APP_KEY,
  B2_APP_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_REGION,
} from './s3-credentials';
import type { Secret } from './secret';
import { STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY } from './stripe-secrets';
import {
  TURBO_CACHE,
  TURBO_LOG_ORDER,
  TURBO_TEAM,
  TURBO_TELEMETRY_DISABLED,
  TURBO_TOKEN,
} from './turbo-token';

/**
 * Exhaustive registry of every managed secret. Orphans (stored keys not in
 * this list) are purged on provision; `check:secrets` allows them.
 */
export const SECRETS: readonly Secret[] = [
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID,
  DATABASE_URL,
  AUTH_PUBLISHABLE_KEY,
  AUTH_SECRET_KEY,
  EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY,
  CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY,
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  TURBO_TOKEN,
  TURBO_TEAM,
  TURBO_CACHE,
  TURBO_LOG_ORDER,
  TURBO_TELEMETRY_DISABLED,
  EXPO_TOKEN,
  B2_MASTER_KEY_ID,
  B2_MASTER_KEY,
  B2_APP_KEY_ID,
  B2_APP_KEY,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_REGION,
  ELEVEN_LABS_API_KEY,
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  API_URL,
  EXPO_PUBLIC_API_URL,
  LOCAL_PREVIEW_API_ORIGIN,
  EXPO_PUBLIC_COMMIT_HASH,
  EXPO_PUBLIC_COMMIT_DATE,
  OBSERVABILITY_BACKEND,
  SENTRY_DSN,
  EXPO_PUBLIC_OBSERVABILITY_BACKEND,
  EXPO_PUBLIC_SENTRY_DSN,
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
