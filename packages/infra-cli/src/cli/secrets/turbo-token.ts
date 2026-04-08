import type { SecretEntry } from './types';

export class TurboToken implements SecretEntry {
  readonly doppler = 'TURBO_TOKEN';
  readonly env = 'TURBO_TOKEN';
  readonly hint = 'Any random string, e.g.: openssl rand -hex 32';

  async validate(token: string): Promise<string | null> {
    try {
      const res = await fetch('https://turbo-cache.gamezilla.app/health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return null;
      return `Turbo cache health check returned HTTP ${res.status}`;
    } catch {
      return null;
    }
  }
}
