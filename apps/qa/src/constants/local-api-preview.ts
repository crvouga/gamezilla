import { execSync } from 'node:child_process';

import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@gamezilla/domain/config/api-servers';
import { createDopplerSecretStoreForScripts } from '@gamezilla/lib/secret-store';

const SECRET_NAME = 'LOCAL_PREVIEW_API_ORIGIN';

function trimStringOrNull(v: string | undefined): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Loopback API origin for local wrangler dev: `LOCAL_PREVIEW_API_ORIGIN` from
 * env or Doppler when set; otherwise {@link DEFAULT_LOCAL_PREVIEW_API_ORIGIN}.
 */
export async function resolveLocalPreviewApiOrigin(): Promise<string> {
  const fromEnv = trimStringOrNull(process.env['LOCAL_PREVIEW_API_ORIGIN']);
  if (fromEnv !== null) return fromEnv;
  const store = createDopplerSecretStoreForScripts();
  const fromDoppler = await store.getOptional(SECRET_NAME);
  const trimmed =
    typeof fromDoppler === 'string' && fromDoppler.trim().length > 0
      ? fromDoppler.trim()
      : null;
  return trimmed ?? DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}

/**
 * Synchronous mirror of {@link resolveLocalPreviewApiOrigin} for callers that
 * cannot use top-level `await` — notably Playwright's config loader, which
 * uses CommonJS `require()` and rejects async ESM modules. Reads env first,
 * then shells out to `doppler secrets get` synchronously, then falls back to
 * {@link DEFAULT_LOCAL_PREVIEW_API_ORIGIN}.
 */
export function resolveLocalPreviewApiOriginSync(): string {
  const fromEnv = trimStringOrNull(process.env['LOCAL_PREVIEW_API_ORIGIN']);
  if (fromEnv !== null) return fromEnv;
  try {
    const out = execSync(`doppler secrets get ${SECRET_NAME} --plain`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (out.length > 0) return out;
  } catch {
    // Doppler CLI unavailable, not configured for this directory, or the
    // secret is unset — fall through to the hardcoded default.
  }
  return DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}
