import type { SecretEntry } from './types';

export class ApiUrl implements SecretEntry {
  readonly secretKey = 'API_URL';
  readonly env = 'API_URL';
  readonly hint =
    'Public origin of the unified Worker (https://www.…), no path — used by Stripe webhooks and tooling';

  async validate(value: string): Promise<string | null> {
    const v = value.trim();
    if (v.length === 0) return 'Must be non-empty';
    try {
      const u = new URL(v);
      if (u.pathname !== '' && u.pathname !== '/') {
        return 'Must be an origin only (no path)';
      }
    } catch {
      return 'Must be a valid URL';
    }
    if (!v.startsWith('https://') && !v.startsWith('http://')) {
      return 'Must start with http:// or https://';
    }
    return null;
  }
}
