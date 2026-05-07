import type { SecretEntry } from './types';

export class BetterAuthSecret implements SecretEntry {
  readonly secretKey = 'BETTER_AUTH_SECRET';
  readonly env = 'BETTER_AUTH_SECRET';
  readonly hint =
    'Better Auth secret (≥32 bytes) — e.g. `openssl rand -hex 32`';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return 'Must be non-empty when set';
    if (v.length < 32) return 'Must be at least 32 characters';
    return null;
  }
}
