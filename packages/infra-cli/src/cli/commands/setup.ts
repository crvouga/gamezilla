import { assert } from '@gamezilla/shared/assert';
import { createInterface } from 'node:readline/promises';
import { ALL_DEPS } from '../deps/registry';
import { ensureDopplerDefaults } from '../lib/ensure-doppler-defaults';
import { ensureTurboCacheSecret } from '../lib/ensure-turbo-cache-secret';
import {
  banner,
  fmt,
  fail as fmtFail,
  info,
  ok,
  warn,
} from '../lib/fmt';
import { resolveDatabaseUrl } from '../lib/resolve-database-url';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { createEnsureRegistry } from '../resources/registry';
import type { InfraContext } from '../resources/types';
import {
  getSecretMap,
  loadSecretsIntoEnv,
  setDopplerSecret,
  validateSecret,
} from '../secrets/secrets';
import type { Command } from './types';

export class SetupCommand implements Command {
  readonly id = 'setup';
  readonly summary =
    'Self-healing init: deps, secrets, idempotent resource ensures';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Setup');
    const p = this.platform;

    await runStep(p, 'Dependencies', () => this.ensureDeps());

    const missingEnvs = await runStep(p, 'Load secrets', () => {
      const secrets = loadSecretsIntoEnv();
      for (const s of secrets) {
        if (s.set) ok(s.env);
        else fmtFail(s.env, 'not found in Doppler');
      }
      ensureDopplerDefaults();
      return new Set(secrets.filter((s) => !s.set).map((s) => s.env));
    });

    if (missingEnvs.size > 0) {
      await this.promptForMissingSecrets(missingEnvs);
    }

    await runStep(p, 'Validate secrets', async () => {
      const secretMap = getSecretMap();
      let validationFailed = false;
      for (const entry of secretMap) {
        const value = process.env[entry.env];
        if (!value) continue;
        const err = await validateSecret(entry, value);
        if (err) {
          fmtFail(entry.doppler, err);
          validationFailed = true;
        } else {
          ok(entry.doppler);
        }
      }
      assert.ok(
        !validationFailed,
        'Secret validation failed — fix the issues above before continuing'
      );
    });

    await runStep(p, 'Sync TURBO_TOKEN to Worker', () =>
      ensureTurboCacheSecret()
    );

    await runStep(p, 'Resolve DATABASE_URL', async () => {
      const url = await resolveDatabaseUrl();
      ok('DATABASE_URL', url.replace(/\/\/[^@]+@/, '//***:***@'));
    });

    const ctx: InfraContext = {};
    const resources = createEnsureRegistry();
    for (const resource of resources) {
      await runStep(p, `Ensure: ${resource.id}`, () =>
        resource.ensure(p, ctx)
      );
    }

    banner('Setup Complete', performance.now() - t0);
    ok('Infrastructure is healthy');
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
        console.log(`  ${fmt.bold(s.doppler)}`);
        console.log(`  ${fmt.dim(s.hint)}`);
        const value = await rl.question(`  ${fmt.cyan('value:')} `);
        const trimmed = value.trim();

        if (trimmed === '') {
          info(s.doppler, 'skipped');
          continue;
        }

        const error = await validateSecret(s, trimmed);
        if (error !== null) {
          fmtFail(s.doppler, error);
          continue;
        }

        setDopplerSecret(s.doppler, trimmed);
        process.env[s.env] = trimmed;
        ok(s.doppler, 'saved to Doppler');
        set++;
      }

      console.log('');
      info('done', `${set} secret(s) added, ${missing.length - set} skipped`);
    } finally {
      rl.close();
    }
  }

  private ensureDeps(): void {
    for (const dep of ALL_DEPS) {
      const status = dep.check();

      if (status.ok) {
        ok(dep.name, status.version);
        continue;
      }

      warn(dep.name, status.reason);
      info(dep.name, 'installing…');
      try {
        dep.install();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        fmtFail(dep.name, `install failed — ${msg}`);
        assert.fail(`setup: could not install ${dep.name}`);
      }
      const after = dep.check();
      if (!after.ok) {
        fmtFail(dep.name, `still not available — ${after.reason}`);
        assert.fail(`setup: ${dep.name} not available after install`);
      }
      ok(dep.name, `installed (${after.version})`);

      if (dep.verify) dep.verify();
    }
  }
}
