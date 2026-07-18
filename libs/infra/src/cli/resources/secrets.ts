import { assert } from '@pkgs/assert';
import { resolveInfisicalAccessTokenForWrites } from '@pkgs/secret-store';
import { PROJECT_CONFIG } from '../../project-config';
import { ok, warn } from '../lib/fmt';
import {
  applySeededS3ToEnv,
  clearS3SecretSeedCache,
  seedObjectStoreS3ForEnv,
} from '../lib/s3-secret-seed';
import { REPO_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import {
  getMirrorToDevSecrets,
  getRegistrySecretNames,
  getSeedableSecrets,
  SECRETS,
} from '../secrets/registry';
import {
  activeSecretsEnv,
  SECRETS_ENVS,
  type SecretsEnv,
} from '../secrets/secret';
import {
  deleteSecretIn,
  exportSecretsMap,
  fetchSecret,
  fetchSecretFrom,
  listSecretNames,
  loadSecretsIntoEnv,
  setSecret,
  setSecretIn,
  validateSecretOrError,
} from '../secrets/secrets';
import { ResourceBase, type InfraContext } from './types';

assert.notThrows(
  () => crypto.randomUUID(),
  'crypto.randomUUID must be available'
);

const legacyWwwApiOrigin = (): string =>
  `https://www.${PROJECT_CONFIG.domain}`;

export class SecretsResource extends ResourceBase {
  readonly id = 'secrets';

  async provision(platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    await this.ensureInfisicalCliWriteToken(platform);
    this.loadSecrets(platform);
    await this.seedSecrets(platform);
    await this.validateSecrets(platform);
    this.mirrorSharedToDev(platform);
    this.purgeOrphans(platform);
  }

  private async ensureInfisicalCliWriteToken(
    platform: CiPlatform
  ): Promise<void> {
    const existing = (process.env['INFISICAL_TOKEN'] ?? '').trim();
    if (existing.length > 0) return;

    const token = await resolveInfisicalAccessTokenForWrites({
      repoRoot: REPO_ROOT,
    });
    if (token === null) {
      if (process.env['GITHUB_ACTIONS'] === 'true') {
        platform.warning(
          'No Infisical write token (OIDC) — secret store writes and prd→dev mirrors may fail'
        );
      }
      return;
    }
    process.env['INFISICAL_TOKEN'] = token;
    ok('Infisical CLI', 'write token ready (OIDC)');
  }

  async destroy(): Promise<void> {
    ok('Secrets', 'nothing to tear down');
  }

  loadSecretsQuick(): void {
    for (const entry of SECRETS) {
      const existing = process.env[entry.name];
      if (typeof existing === 'string' && existing.trim().length > 0) continue;
      try {
        process.env[entry.name] = fetchSecret(entry.name);
      } catch (e) {
        if (entry.optional) continue;
        warn(
          entry.name,
          `secret get failed: ${e instanceof Error ? e.message : String(e)}`
        );
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
        continue;
      }
      if (r.optional) continue;
      warn(r.env, 'not found in secret store');
      failed++;
    }

    if (loaded > 0) ok('Secrets loaded', String(loaded));
    if (failed > 0) {
      platform.warning(`${failed} secret(s) missing from secret store`);
    }
  }

  private async seedSecrets(platform: CiPlatform): Promise<void> {
    clearS3SecretSeedCache();
    const active = activeSecretsEnv();

    for (const env of SECRETS_ENVS) {
      const stored = exportSecretsMap(env);
      try {
        const seeded = await seedObjectStoreS3ForEnv(env, stored);
        if (env === active) applySeededS3ToEnv(seeded);
        ok('S3 secrets', `${env} → ${seeded.bucket}`);
      } catch (e) {
        platform.warning(
          `S3 seed (${env}) failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    const storedActive = new Map(exportSecretsMap(active));
    for (const entry of getSeedableSecrets()) {
      if (entry.name.startsWith('S3_')) continue;
      const current = (storedActive.get(entry.name) ?? '').trim();
      const shouldRewriteLegacyWww =
        (entry.name === 'API_URL' || entry.name === 'EXPO_PUBLIC_API_URL') &&
        current === legacyWwwApiOrigin();

      if (current.length > 0 && !shouldRewriteLegacyWww) continue;
      if (entry.seed === undefined) continue;

      try {
        const value = await entry.seed({ env: active, secrets: storedActive });
        if (value.trim().length === 0) continue;
        setSecret(entry.name, value);
        process.env[entry.name] = value;
        storedActive.set(entry.name, value);
        ok(
          entry.name,
          shouldRewriteLegacyWww
            ? 'rewrote legacy www origin → api. in secret store'
            : 'seeded in secret store'
        );
      } catch (e) {
        platform.warning(
          `Seed ${entry.name} failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  private async validateSecrets(platform: CiPlatform): Promise<void> {
    const active = activeSecretsEnv();
    const secrets = exportSecretsMap(active);
    let validationFailed = false;

    for (const entry of SECRETS) {
      const value = secrets.get(entry.name) ?? process.env[entry.name];
      if (value === undefined || value.trim().length === 0) {
        if (!entry.optional) {
          platform.error(`${entry.name}: missing`);
          validationFailed = true;
        }
        continue;
      }
      const err = await validateSecretOrError(entry, {
        env: active,
        secretValue: value,
        secrets,
      });
      if (err) {
        platform.error(`${entry.name}: ${err}`);
        validationFailed = true;
      } else {
        ok(entry.name);
      }
    }

    assert.ok(
      !validationFailed,
      'Secret validation failed — fix the issues above before continuing'
    );
  }

  private mirrorSharedToDev(platform: CiPlatform): void {
    const active = (process.env['SECRETS_ENV'] ?? '').trim();
    if (active === '' || active === 'dev') return;

    let mirrored = 0;
    let skipped = 0;
    for (const entry of getMirrorToDevSecrets()) {
      const source = process.env[entry.name];
      if (typeof source !== 'string' || source.length === 0) continue;

      let current: string | null = null;
      try {
        current = fetchSecretFrom('dev', entry.name);
      } catch {
        current = null;
      }

      if (current === source) {
        skipped++;
        continue;
      }

      try {
        setSecretIn('dev', entry.name, source);
        mirrored++;
      } catch (e) {
        platform.warning(
          `Failed to mirror ${entry.name} from ${active} → dev: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    if (mirrored > 0) {
      ok('Secrets dev mirror', `mirrored ${active} → dev (${mirrored})`);
    } else if (skipped > 0) {
      ok('Secrets dev mirror', `already in sync with dev (${skipped})`);
    }
  }

  private purgeOrphans(platform: CiPlatform): void {
    const managed = getRegistrySecretNames();
    for (const env of SECRETS_ENVS) {
      this.purgeOrphansInEnv(platform, env, managed);
    }
  }

  private purgeOrphansInEnv(
    platform: CiPlatform,
    env: SecretsEnv,
    managed: ReadonlySet<string>
  ): void {
    let actual: ReadonlyArray<string>;
    try {
      actual = listSecretNames(env);
    } catch (e) {
      warn(
        `Orphan purge (${env})`,
        e instanceof Error ? e.message : String(e)
      );
      return;
    }

    const orphans = actual.filter((name) => !managed.has(name));
    if (orphans.length === 0) {
      ok('Secrets invariant', `${env}: all secrets are registry-managed`);
      return;
    }

    platform.warning(
      `Purging ${orphans.length} orphan secret(s) from ${env}: ${orphans.join(', ')}`
    );
    for (const name of orphans) {
      try {
        deleteSecretIn(env, name);
        ok('Purged orphan', `${env}/${name}`);
      } catch (e) {
        platform.warning(
          `Failed to purge ${env}/${name}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }
}
