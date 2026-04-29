import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@gamezilla/domain/config/api-servers';
import { createDopplerSecretStoreForScripts } from '@gamezilla/lib/secret-store';

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
  const fromEnv = trimStringOrNull(process.env.LOCAL_PREVIEW_API_ORIGIN);
  if (fromEnv !== null) return fromEnv;
  const store = createDopplerSecretStoreForScripts();
  const fromDoppler = await store.getOptional('LOCAL_PREVIEW_API_ORIGIN');
  const trimmed =
    typeof fromDoppler === 'string' && fromDoppler.trim().length > 0
      ? fromDoppler.trim()
      : null;
  return trimmed ?? DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}
