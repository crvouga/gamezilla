import type { SecretEntry } from './types';

export class BetterAuthAppName implements SecretEntry {
  readonly secretKey = 'BETTER_AUTH_APP_NAME';
  readonly env = 'BETTER_AUTH_APP_NAME';
  readonly optional = true;
  readonly hint =
    'Optional Better Auth app display name (defaults to the product display name). Leave unset to use the default.';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return null;
    if (v.length > 128) return 'Must be at most 128 characters';
    return null;
  }
}
