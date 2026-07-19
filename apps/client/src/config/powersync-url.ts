import { assert } from '@pkgs/assert';

/** PowerSync instance URL from `EXPO_PUBLIC_PS_URL` (setup-env / secrets). */
export function getPowerSyncUrl(): string {
  // eslint-disable-next-line expo/no-dynamic-env-var -- bracket access required by TS index signature rule
  const raw = process.env['EXPO_PUBLIC_PS_URL'];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  assert.nonEmptyString(
    trimmed,
    'EXPO_PUBLIC_PS_URL must be set (run apps/client setup or provision PS_URL in secrets)'
  );
  return trimmed;
}
