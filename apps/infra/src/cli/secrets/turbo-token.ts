import { PROJECT_CONFIG, turboCachePublicUrl } from '../../project-config';
import type { SecretEntry } from './types';

export class TurboToken implements SecretEntry {
  readonly doppler = 'TURBO_TOKEN';
  readonly env = 'TURBO_TOKEN';
  readonly hint = 'Any random string, e.g.: openssl rand -hex 32';

  async validate(token: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${turboCachePublicUrl()}/v8/artifacts/status?teamId=default`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) return null;
      return `Turbo cache token check returned HTTP ${res.status}`;
    } catch {
      return null;
    }
  }
}

export class TurboApi implements SecretEntry {
  readonly doppler = 'TURBO_API';
  readonly env = 'TURBO_API';
  readonly hint = turboCachePublicUrl();

  async validate(url: string): Promise<string | null> {
    try {
      const parsed = new URL(url);
      const expected = new URL(turboCachePublicUrl());
      if (parsed.origin !== expected.origin) {
        return `Expected TURBO_API origin ${expected.origin} (use the turbo-cache custom domain, not *.workers.dev)`;
      }
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

/** Forces turbo to use the self-hosted remote cache for every invocation.
 * Same syntax as the `--cache` CLI flag. */
export class TurboCache implements SecretEntry {
  readonly doppler = 'TURBO_CACHE';
  readonly env = 'TURBO_CACHE';
  readonly hint = 'remote:rw';

  async validate(value: string): Promise<string | null> {
    if (!/^(local|remote):(r|rw|w)?(,(local|remote):(r|rw|w)?)?$/.test(value)) {
      return `Invalid TURBO_CACHE value: ${value} (expected e.g. "remote:rw")`;
    }
    return null;
  }
}
