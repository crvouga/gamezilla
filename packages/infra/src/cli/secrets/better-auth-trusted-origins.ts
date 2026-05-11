import type { SecretEntry } from './types';

export class BetterAuthTrustedOrigins implements SecretEntry {
  readonly secretKey = 'BETTER_AUTH_TRUSTED_ORIGINS';
  readonly env = 'BETTER_AUTH_TRUSTED_ORIGINS';
  readonly optional = true;
  readonly hint =
    'Optional newline-separated Better Auth trustedOrigins (in addition to API_URL). When set, replaces implicit defaults — include gamezilla:// and exp://** if you use Expo.';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return null;
    for (const line of v.split('\n')) {
      const t = line.trim();
      if (t.length === 0) continue;
      if (t.length > 2048) return 'Each line must be at most 2048 characters';
      if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) {
        return `Each non-empty line must look like a URL or custom scheme (got: ${t.slice(0, 40)}…)`;
      }
    }
    return null;
  }
}
