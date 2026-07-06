import { execSync } from 'node:child_process';

import { createVaultSecretStoreForScripts } from '@pkgs/secret-store';

/** Loopback origin for `wrangler dev` in this repo (`apps/api` uses port 8788). */
export const DEFAULT_LOCAL_PREVIEW_API_ORIGIN =
  'http://localhost:8788' as const;

const SECRET_NAME = 'LOCAL_PREVIEW_API_ORIGIN';

function trimStringOrNull(v: string | undefined): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Loopback API origin for local wrangler dev: `LOCAL_PREVIEW_API_ORIGIN` from
 * env or Vault when set; otherwise {@link DEFAULT_LOCAL_PREVIEW_API_ORIGIN}.
 */
export async function resolveLocalPreviewApiOrigin(): Promise<string> {
  const fromEnv = trimStringOrNull(process.env['LOCAL_PREVIEW_API_ORIGIN']);
  if (fromEnv !== null) return fromEnv;
  const store = createVaultSecretStoreForScripts();
  const fromVault = (await store.getOptional(SECRET_NAME))?.readSecretValue();
  const trimmed =
    typeof fromVault === 'string' && fromVault.trim().length > 0
      ? fromVault.trim()
      : null;
  return trimmed ?? DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}

/**
 * Synchronous mirror of {@link resolveLocalPreviewApiOrigin} for callers that
 * cannot use top-level `await` — notably Playwright's config loader.
 */
export function resolveLocalPreviewApiOriginSync(): string {
  const fromEnv = trimStringOrNull(process.env['LOCAL_PREVIEW_API_ORIGIN']);
  if (fromEnv !== null) return fromEnv;
  try {
    const out = execSync(
      `vault kv get -mount=secret -field=${SECRET_NAME} personal/dev`,
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    ).trim();
    if (out.length > 0) return out;
  } catch {
    // Vault CLI unavailable or secret unset — fall through to default.
  }
  return DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}
