import { assert } from '@gamezilla/shared/assert';
import { createInterface } from 'node:readline/promises';
import { ALL_DEPS } from '../deps/registry';
import {
  banner,
  fmt,
  fail as fmtFail,
  info,
  ok,
  warn,
} from '../lib/fmt';
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
  readonly summary =
    'Install CLI dependencies and configure Doppler secrets';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Setup');

    await runStep(this.platform, 'Dependencies', () => this.ensureDeps());

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

    banner('Setup Complete', performance.now() - t0);
    ok('CLI is ready');
    info('Next step', 'Run `bun run infra deploy` for a full deploy');
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private async promptForMissingSecrets(
    missingEnvs: Set<string>,
  ): Promise<void> {
    const secretMap = getSecretMap();
    const missing = secretMap.filter((s) => missingEnvs.has(s.env));
    if (missing.length === 0) return;

    if (process.env['CI']) {
      this.platform.warning(
        `${missing.length} secret(s) missing — cannot prompt in CI`,
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
