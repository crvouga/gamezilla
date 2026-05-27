import { assert } from '@pkgs/assert';
import { createInterface } from 'node:readline/promises';
import { ALL_DEPS, DEPLOY_DEPS } from '../deps/registry';
import { isAtLeastLatest } from '../deps/semver';
import type { Dep } from '../deps/types';
import { banner, fmt, fail as fmtFail, info, ok, warn } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import {
  getSecretMap,
  loadSecretsIntoEnv,
  setDopplerSecret,
  validateSecret,
} from '../secrets/secrets';
import type { Command } from './types';

export class SetupCommand implements Command {
  readonly id = 'setup';
  readonly group = 'setup' as const;
  readonly summary = 'CLI tools + Doppler secrets';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Setup');

    const deps = process.env['CI'] ? DEPLOY_DEPS : ALL_DEPS;

    await runStep(this.platform, 'Dependencies', () =>
      this.ensureDepsAsync(deps)
    );

    const missingEnvs = await runStep(this.platform, 'Load secrets', () => {
      const secrets = loadSecretsIntoEnv();
      for (const s of secrets) {
        if (s.set) ok(s.env);
        else fmtFail(s.env, 'not found in Doppler');
      }
      return new Set(secrets.filter((s) => !s.set).map((s) => s.env));
    });

    if (missingEnvs.size > 0) {
      await this.promptForMissingSecrets(missingEnvs);
    }

    // Defer tool verification until secrets are loaded into `process.env` so
    // auth-gated binaries (e.g. `wrangler whoami`) succeed in CI.
    await runStep(this.platform, 'Verify tools', () => {
      for (const dep of deps) {
        if (dep.verify) dep.verify();
      }
    });

    banner('Setup Complete', performance.now() - t0);
    ok('CLI is ready');
    info('Next step', 'Run `bun run infra deploy` for a full deploy');
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private async promptForMissingSecrets(
    missingEnvs: Set<string>
  ): Promise<void> {
    const secretMap = getSecretMap();
    const missing = secretMap.filter((s) => missingEnvs.has(s.env));
    if (missing.length === 0) return;

    if (process.env['CI']) {
      this.platform.warning(
        `${missing.length} secret(s) missing — cannot prompt in CI`
      );
      return;
    }

    info('tip', 'leave blank to skip a secret');
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      let set = 0;
      for (const s of missing) {
        console.log('');
        console.log(`  ${fmt.bold(s.secretKey)}`);
        console.log(`  ${fmt.dim(s.hint)}`);
        const value = await rl.question(`  ${fmt.cyan('value:')} `);
        const trimmed = value.trim();

        if (trimmed === '') {
          info(s.secretKey, 'skipped');
          continue;
        }

        const error = await validateSecret(s, trimmed);
        if (error !== null) {
          fmtFail(s.secretKey, error);
          continue;
        }

        setDopplerSecret(s.secretKey, trimmed);
        process.env[s.env] = trimmed;
        ok(s.secretKey, 'saved to Doppler');
        set++;
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
