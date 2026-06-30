import type { ApiWorkerEnv } from './env';
import { ApiSecretName } from './secret-names';

function readBinding(
  env: ApiWorkerEnv,
  key: keyof ApiWorkerEnv
): string | null {
  const raw = env[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Worker bindings mirrored into `.dev.vars` by `setup-dev-vars`. When present,
 * these are preferred over live Vault KV reads so local dev stays up when Vault
 * blips during high-frequency patch-db polling.
 */
export function readDevBindingSecrets(
  env: ApiWorkerEnv
): Readonly<Record<string, string>> {
  const entries: ReadonlyArray<readonly [string, string | null]> = [
    [ApiSecretName.dbUrl, readBinding(env, 'DATABASE_URL')],
    [ApiSecretName.apiUrl, readBinding(env, 'API_URL')],
    [ApiSecretName.betterAuthSecret, readBinding(env, 'BETTER_AUTH_SECRET')],
    [
      ApiSecretName.googleWebClientId,
      readBinding(env, 'WEB_CLIENT_GOOGLE_CLIENT_ID'),
    ],
    [
      ApiSecretName.googleWebClientSecret,
      readBinding(env, 'WEB_CLIENT_GOOGLE_CLIENT_SECRET'),
    ],
  ];
  const out: Record<string, string> = {};
  for (const [name, value] of entries) {
    if (value !== null) {
      out[name] = value;
    }
  }
  return out;
}
