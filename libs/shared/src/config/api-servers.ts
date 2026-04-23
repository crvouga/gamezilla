import { assert } from '@gamezilla/shared/assert';

/**
 * Public API origin (scheme + host + port, no path). Invariant: set at build time
 * via `EXPO_PUBLIC_API_URL` (see `apps/client/scripts/setup-env.ts` and Doppler).
 * No implicit fallback — misconfiguration fails loudly (Tiger Style).
 */
export function getApiBaseUrl(): string {
  const raw = process.env['EXPO_PUBLIC_API_URL'];
  assert.nonEmptyString(
    raw,
    'EXPO_PUBLIC_API_URL is required; run `bun run dev` (with Doppler) or set apps/client/.env.local'
  );
  try {
    return new URL(raw).origin;
  } catch (error) {
    assert.ok(false, 'EXPO_PUBLIC_API_URL must be a valid absolute URL', {
      raw,
      error,
    });
    throw new Error('unreachable');
  }
}
