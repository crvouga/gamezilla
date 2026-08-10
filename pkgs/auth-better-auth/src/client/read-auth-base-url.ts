import { assert } from '@pkgs/assert';

let configuredBaseURL: string | null = null;

export function configureAuthBaseURL(baseURL: string): void {
  const trimmed = baseURL.trim().replace(/\/$/, '');
  assert.nonEmptyString(trimmed, 'Better Auth baseURL is required');
  configuredBaseURL = trimmed;
}

export function readAuthBaseURL(): string {
  if (configuredBaseURL !== null) return configuredBaseURL;
  const fromEnv = process.env['EXPO_PUBLIC_API_URL']?.trim().replace(/\/$/, '');
  assert.nonEmptyString(
    fromEnv,
    'EXPO_PUBLIC_API_URL is required for Better Auth (run apps/client setup)'
  );
  configuredBaseURL = fromEnv;
  return fromEnv;
}
