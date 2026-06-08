import type { SecretStore } from '@pkgs/secret-store';

import { APP_IDENTITY, appDeepLinkOrigin } from '../shared/app-identity';
import { isLocalApiOrigin } from '../shared/local-api-origin';
import { BetterAuthSecretName } from './better-auth-secret-names';

export { isLocalApiOrigin };

/** Expo / deep-link schemes — not sensitive; always allowed unless overridden by secret list. */
const DEFAULT_MOBILE_TRUSTED = [
  appDeepLinkOrigin(),
  `${appDeepLinkOrigin()}*`,
  'exp://**',
] as const;

/** Worker / API origin in local dev (wrangler, etc.). */
const LOCAL_DEV_TRUSTED = [
  'http://127.0.0.1:8788',
  'http://localhost:8788',
  'https://localhost:8788',
] as const;

/**
 * Browser app origins when the API runs locally. `trustedOrigins` is the **page**
 * `Origin` (Vite, Expo web, Next), not the API host — missing entries surface as
 * opaque “CORS” failures because Better Auth rejects the request first.
 */
const LOCAL_WEB_CLIENT_TRUSTED = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
] as const;

/**
 * Google OAuth `state` cookie is host-only. In local web dev, `localhost` and
 * `127.0.0.1` are different cookie jars; mixing them causes callback
 * `state_mismatch` (cookie absent on callback). Normalize loopback host to
 * `localhost` for hosted auth URLs in local mode.
 */
function normalizeLocalHostedAuthOrigin(apiOrigin: string): string {
  if (!isLocalApiOrigin(apiOrigin)) return apiOrigin;
  try {
    const u = new URL(apiOrigin);
    if (u.hostname === '127.0.0.1') {
      u.hostname = 'localhost';
      return u.origin;
    }
  } catch {
    /* keep input on parse failure */
  }
  return apiOrigin;
}

function parseTrustedOriginsMultiline(raw: string | null): string[] {
  if (raw === null || raw.trim().length === 0) return [];
  const out: string[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (t.length > 0) out.push(t);
  }
  return out;
}

/**
 * When {@link BetterAuthSecretName.betterAuthTrustedOrigins} is set, it is
 * the source of truth (plus API origin). Otherwise we derive a safe default
 * (API origin + mobile schemes + local wrangler + common web dev origins when API_URL is local).
 */
function buildTrustedOrigins(
  apiOrigin: string,
  secretExtra: string | null
): readonly string[] {
  const trimmedApi = apiOrigin.replace(/\/$/, '');
  const extra = parseTrustedOriginsMultiline(secretExtra);
  if (extra.length > 0) {
    return [...new Set([trimmedApi, ...extra])];
  }
  const set = new Set<string>([trimmedApi, ...DEFAULT_MOBILE_TRUSTED]);
  if (isLocalApiOrigin(trimmedApi)) {
    for (const u of LOCAL_DEV_TRUSTED) set.add(u);
    for (const u of LOCAL_WEB_CLIENT_TRUSTED) set.add(u);
  }
  return [...set];
}

export type LoadedBetterAuthSecretsWorker = {
  readonly secret: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly apiOrigin: string;
  readonly baseURL: string;
  readonly appName: string;
  readonly trustedOrigins: readonly string[];
};

export type LoadedBetterAuthSecrets = LoadedBetterAuthSecretsWorker & {
  readonly dbUrl: string;
};

/**
 * Better Auth options from the secret store **without** `DATABASE_URL` (Worker loads it per request).
 */
export async function loadBetterAuthSecretsWorker(
  secretStore: SecretStore,
  apiUrlOverride?: string | null
): Promise<LoadedBetterAuthSecretsWorker> {
  const secret = (
    await secretStore.getRequired(BetterAuthSecretName.betterAuthSecret)
  )
    .readSecretValue()
    .trim();
  const googleClientId = (
    await secretStore.getRequired(BetterAuthSecretName.googleWebClientId)
  )
    .readSecretValue()
    .trim();
  const googleClientSecret = (
    await secretStore.getRequired(BetterAuthSecretName.googleWebClientSecret)
  )
    .readSecretValue()
    .trim();
  const trimmedOverride =
    typeof apiUrlOverride === 'string' ? apiUrlOverride.trim() : '';
  const apiUrlRaw =
    trimmedOverride.length > 0
      ? trimmedOverride
      : (
          await secretStore.getRequired(BetterAuthSecretName.apiUrl)
        ).readSecretValue();
  const apiOrigin = apiUrlRaw.replace(/\/$/, '');
  const hostedAuthOrigin = normalizeLocalHostedAuthOrigin(apiOrigin);
  const baseURL = `${hostedAuthOrigin}/api/auth`;

  const appNameRaw = (
    await secretStore.getOptional(BetterAuthSecretName.betterAuthAppName)
  )?.readSecretValue();
  const appName =
    typeof appNameRaw === 'string' && appNameRaw.trim().length > 0
      ? appNameRaw.trim()
      : APP_IDENTITY.displayName;

  const trustedRaw =
    (
      await secretStore.getOptional(
        BetterAuthSecretName.betterAuthTrustedOrigins
      )
    )?.readSecretValue() ?? null;
  const trustedOrigins = buildTrustedOrigins(apiOrigin, trustedRaw);

  return {
    secret,
    googleClientId,
    googleClientSecret,
    apiOrigin,
    baseURL,
    appName,
    trustedOrigins,
  };
}

export async function loadBetterAuthSecrets(
  secretStore: SecretStore
): Promise<LoadedBetterAuthSecrets> {
  const worker = await loadBetterAuthSecretsWorker(secretStore);
  const dbUrl = (
    await secretStore.getRequired(BetterAuthSecretName.dbUrl)
  ).readSecretValue();
  return { ...worker, dbUrl };
}
