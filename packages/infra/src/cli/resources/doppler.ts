import { assert } from '@gamezilla/shared/assert';
import { PROJECT_CONFIG, turboCachePublicUrl } from '../../project-config';
import { ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import {
  fetchDopplerSecret,
  getSecretMap,
  loadSecretsIntoEnv,
  setDopplerSecret,
  validateSecret,
} from '../secrets/secrets';
import { ResourceBase, type InfraContext } from './types';

assert.notThrows(
  () => crypto.randomUUID(),
  'crypto.randomUUID must be available'
);

const DERIVED_DEFAULTS: Record<string, () => string> = {
  TURBO_TOKEN: () => crypto.randomUUID(),
  TURBO_API: () => turboCachePublicUrl(),
  TURBO_TEAM: () => `team_${PROJECT_CONFIG.domain.replace(/\.\w+$/, '')}`,
  TURBO_LOG_ORDER: () => 'stream',
  EXPO_PUBLIC_API_URL: () => `https://api.${PROJECT_CONFIG.domain}`,
};

export class DopplerResource extends ResourceBase {
  readonly id = 'doppler';

  async provision(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    this.loadSecrets(platform);
    await this.validateSecrets(platform);
    this.ensureDefaults();
  }

  async destroy(): Promise<void> {
    ok('Doppler', 'nothing to tear down');
  }

  /**
   * Minimal secret loading for commands that need env vars before the
   * full resource DAG runs (e.g. destroy).
   */
  loadSecretsQuick(): void {
    for (const { doppler, env } of getSecretMap()) {
      if (process.env[env]) continue;
      try {
        process.env[env] = fetchDopplerSecret(doppler);
      } catch {
        /* best-effort */
      }
    }
  }

  private loadSecrets(platform: CiPlatform): void {
    const results = loadSecretsIntoEnv();
    let loaded = 0;
    let failed = 0;

    for (const r of results) {
      if (r.set) {
        loaded++;
      } else {
        warn(r.env, 'not found in Doppler');
        failed++;
      }
    }

    if (loaded > 0) ok('Doppler secrets loaded', String(loaded));
    if (failed > 0) {
      platform.warning(`${failed} secret(s) missing from Doppler`);
    }
  }

  private async validateSecrets(platform: CiPlatform): Promise<void> {
    const secretMap = getSecretMap();
    let validationFailed = false;

    for (const entry of secretMap) {
      const value = process.env[entry.env];
      if (!value) continue;
      const err = await validateSecret(entry, value);
      if (err) {
        platform.error(`${entry.doppler}: ${err}`);
        validationFailed = true;
      } else {
        ok(entry.doppler);
      }
    }

    assert.ok(
      !validationFailed,
      'Secret validation failed — fix the issues above before continuing'
    );
  }

  private ensureDefaults(): void {
    for (const [key, generate] of Object.entries(DERIVED_DEFAULTS)) {
      if (process.env[key]) continue;

      const value = generate();
      process.env[key] = value;

      try {
        setDopplerSecret(key, value);
        ok(key, 'populated in Doppler');
      } catch {
        ok(key, 'set in env (Doppler save skipped)');
      }
    }
  }
}
