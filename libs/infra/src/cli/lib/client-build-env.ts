import { assert } from '@pkgs/assert';

/**
 * Resolve the auth publishable key Metro inlines into the client bundle as
 * `EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY`. Deploy contexts inject the secret store
 * value as `AUTH_PUBLISHABLE_KEY`; production builds never run
 * `apps/client setup`, so the mapping must happen here. Shipping a bundle
 * without it makes the app throw on launch (`readAuthPublishableKey`).
 */
export function resolveAuthPublishableKeyForClientBuild(): string {
  const fromExpoEnv = process.env['EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY']?.trim();
  if (fromExpoEnv !== undefined && fromExpoEnv.length > 0) {
    return fromExpoEnv;
  }
  const fromSecret = process.env['AUTH_PUBLISHABLE_KEY']?.trim();
  assert.nonEmptyString(
    fromSecret,
    'client build: AUTH_PUBLISHABLE_KEY (or EXPO_PUBLIC_AUTH_PUBLISHABLE_KEY) ' +
      'must be set — without it the bundle throws on launch before sign-in'
  );
  return fromSecret;
}
