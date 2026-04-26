import { assert } from '@gamezilla/lib/assert';

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
  }
}
