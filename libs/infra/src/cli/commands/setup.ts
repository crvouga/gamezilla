import { createInterface } from 'node:readline/promises';
import { assert } from '@pkgs/assert';
import { ALL_DEPS, DEPLOY_DEPS } from '../deps/registry';
import { isAtLeastLatest } from '../deps/semver';
import type { Dep } from '../deps/types';
import { banner, fmt, fail as fmtFail, info, ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { getSecretMap } from '../secrets/registry';
import {
  activeSecretsEnv,
  type Secret,
  type SecretsEnv,
} from '../secrets/secret';
import {
  loadSecretsIntoEnv,
  setSecret,
  validateSecretOrError,
} from '../secrets/secrets';
import type { Command } from './types';

type Readline = ReturnType<typeof createInterface>;

async function trySeedSecret(
  secret: Secret,
  env: SecretsEnv,
  secrets: Map<string, string>,
  rl: Readline
): Promise<boolean> {
  if (secret.seed === undefined) return false;
  const useSeed = await rl.question(
    `  ${fmt.cyan('seed automatically? [Y/n]:')} `
  );
  if (useSeed.trim().toLowerCase() === 'n') return false;
  try {
    const value = await secret.seed({ env, secrets });
    await setSecret(secret.name, value);
    process.env[secret.name] = value;
    secrets.set(secret.name, value);
    ok(secret.name, 'seeded to secret store');
    return true;
  } catch (e) {
    fmtFail(
      secret.name,
      `seed failed: ${e instanceof Error ? e.message : String(e)}`
    );
    return false;
  }
}

async function promptOneSecret(
  secret: Secret,
  env: SecretsEnv,
  secrets: Map<string, string>,
  rl: Readline
): Promise<boolean> {
  console.log('');
  console.log(`  ${fmt.bold(secret.name)}`);
  console.log(`  ${fmt.dim(secret.hint)}`);

  if (await trySeedSecret(secret, env, secrets, rl)) return true;

  const value = await rl.question(`  ${fmt.cyan('value:')} `);
  const trimmed = value.trim();
  if (trimmed === '') {
    info(secret.name, 'skipped');
    return false;
  }

  const error = await validateSecretOrError(secret, {
    env,
    secretValue: trimmed,
    secrets,
  });
  if (error !== null) {
    fmtFail(secret.name, error);
    return false;
  }

  await setSecret(secret.name, trimmed);
  process.env[secret.name] = trimmed;
  secrets.set(secret.name, trimmed);
  ok(secret.name, 'saved to secret store');
  return true;
}

export class SetupCommand implements Command {
  readonly id = 'setup';
  readonly group = 'setup' as const;
  readonly summary = 'CLI tools + secret store';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Setup');

    const deps = process.env['CI'] ? DEPLOY_DEPS : ALL_DEPS;

    await runStep(this.platform, 'Dependencies', () =>
      this.ensureDepsAsync(deps)
    );

    const missingEnvs = await runStep(
      this.platform,
      'Load secrets',
      async () => {
        const secrets = await loadSecretsIntoEnv();
        for (const s of secrets) {
          if (s.set) ok(s.env);
          else if (s.optional) ok(s.env, 'optional / absent');
          else fmtFail(s.env, 'not found in secret store');
        }
        return new Set(
          secrets.filter((s) => !s.set && !s.optional).map((s) => s.env)
        );
      }
    );

    if (missingEnvs.size > 0) {
      await this.promptForMissingSecrets(missingEnvs);
    }

    await runStep(this.platform, 'Verify tools', () => {
      for (const dep of deps) {
        if (dep.verify) dep.verify();
      }
    });

    banner('Setup Complete', performance.now() - t0);
    ok('CLI is ready');
    info('Next step', 'Run `bun run infra deploy` for a full deploy');
  }

  private async promptForMissingSecrets(
    missingEnvs: Set<string>
  ): Promise<void> {
    const secretMap = getSecretMap();
    const missing = secretMap.filter((s) => missingEnvs.has(s.name));
    if (missing.length === 0) return;

    if (process.env['CI']) {
      this.platform.warning(
        `${missing.length} secret(s) missing — cannot prompt in CI`
      );
      return;
    }

    info('tip', 'leave blank to skip a secret; seedable secrets can auto-fill');
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      let set = 0;
      const env = activeSecretsEnv();
      const secrets = new Map<string, string>();
      for (const entry of secretMap) {
        const value = process.env[entry.name];
        if (typeof value === 'string' && value.length > 0) {
          secrets.set(entry.name, value);
        }
      }

      for (const s of missing) {
        if (await promptOneSecret(s, env, secrets, rl)) set++;
      }

      console.log('');
      info('done', `${set} secret(s) added, ${missing.length - set} skipped`);
    } finally {
      rl.close();
    }
  }

  private async ensureDepsAsync(deps: readonly Dep[]): Promise<void> {
    for (const dep of deps) {
      let st = dep.check();

      if (!st.ok) {
        warn(dep.name, st.reason);
        info(dep.name, 'installing…');
        try {
          dep.install();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          fmtFail(dep.name, `install failed — ${msg}`);
          assert.fail(`setup: could not install ${dep.name}`);
        }
        st = dep.check();
        if (!st.ok) {
          fmtFail(dep.name, `still not available — ${st.reason}`);
          assert.fail(`setup: ${dep.name} not available after install`);
        }
      }

      let latest = await dep.fetchLatestVersion();
      if (latest && !isAtLeastLatest(st.version, latest)) {
        warn(dep.name, `outdated (${st.version} → ${latest}), upgrading…`);
        try {
          dep.upgrade();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          fmtFail(dep.name, `upgrade failed — ${msg}`);
          assert.fail(`setup: could not upgrade ${dep.name}`);
        }
        st = dep.check();
        if (!st.ok) {
          fmtFail(dep.name, `not available after upgrade — ${st.reason}`);
          assert.fail(`setup: ${dep.name} broken after upgrade`);
        }
        latest = await dep.fetchLatestVersion();
        if (latest && !isAtLeastLatest(st.version, latest)) {
          assert.fail(
            `setup: ${dep.name} is still behind latest (${latest}), have ${st.version}`
          );
        }
      } else if (!latest) {
        warn(
          dep.name,
          'could not resolve latest version — skipped strict upgrade check'
        );
      }

      ok(dep.name, st.version);
    }
  }
}
