import { createScriptSecretStore } from '@pkgs/secret-store-shared-ts/create-script-secret-store';

import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from './local-preview-api-origin';

const SECRET_NAME = 'LOCAL_PREVIEW_API_ORIGIN';

function trimStringOrNull(v: string | undefined): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Loopback API origin for local wrangler dev: `LOCAL_PREVIEW_API_ORIGIN` from
 * env or the secret store when set; otherwise {@link DEFAULT_LOCAL_PREVIEW_API_ORIGIN}.
 */
export async function resolveLocalPreviewApiOrigin(): Promise<string> {
  const fromEnv = trimStringOrNull(process.env['LOCAL_PREVIEW_API_ORIGIN']);
  if (fromEnv !== null) return fromEnv;
  const store = createScriptSecretStore();
  const fromSecrets = (await store.getOptional(SECRET_NAME))?.readSecretValue();
  const trimmed =
    typeof fromSecrets === 'string' && fromSecrets.trim().length > 0
      ? fromSecrets.trim()
      : null;
  return trimmed ?? DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}

/**
 * Synchronous mirror of {@link resolveLocalPreviewApiOrigin} for callers that
 * cannot use top-level `await` — notably the turbo preview readiness probe.
 */
export function resolveLocalPreviewApiOriginSync(): string {
  const fromEnv = trimStringOrNull(process.env['LOCAL_PREVIEW_API_ORIGIN']);
  if (fromEnv !== null) return fromEnv;
  const fromInjected = trimStringOrNull(process.env[SECRET_NAME]);
  if (fromInjected !== null) return fromInjected;
  return DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}
