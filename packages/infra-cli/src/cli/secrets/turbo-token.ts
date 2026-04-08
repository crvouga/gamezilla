import { PROJECT_CONFIG } from '../../project-config';
import type { SecretEntry } from './types';

export class TurboToken implements SecretEntry {
  readonly doppler = 'TURBO_TOKEN';
  readonly env = 'TURBO_TOKEN';
  readonly hint = 'Any random string, e.g.: openssl rand -hex 32';

  async validate(token: string): Promise<string | null> {
    try {
      const res = await fetch(`https://turbo-cache.${PROJECT_CONFIG.domain}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return null;
      return `Turbo cache health check returned HTTP ${res.status}`;
    } catch {
      return null;
    }
  }
}

export class TurboApi implements SecretEntry {
  readonly doppler = 'TURBO_API';
  readonly env = 'TURBO_API';
  readonly hint = `https://turbo-cache.${PROJECT_CONFIG.domain}`;

  async validate(url: string): Promise<string | null> {
    try {
      new URL(url);
      return null;
    } catch {
      return `Invalid URL: ${url}`;
    }
  }
}

export class TurboTeam implements SecretEntry {
  readonly doppler = 'TURBO_TEAM';
  readonly env = 'TURBO_TEAM';
  readonly hint = `team_${PROJECT_CONFIG.domain.replace(/\.\w+$/, '')}`;

  async validate(): Promise<string | null> {
    return null;
  }
}

export class TurboLogOrder implements SecretEntry {
  readonly doppler = 'TURBO_LOG_ORDER';
  readonly env = 'TURBO_LOG_ORDER';
  readonly hint = 'stream';

  async validate(): Promise<string | null> {
    return null;
  }
}
