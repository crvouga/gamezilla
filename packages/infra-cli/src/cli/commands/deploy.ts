import { assert } from '@gamezilla/shared/assert';
import { createDeployRegistry } from '../lib/deploy-registry';
import { banner, heading, ok } from '../lib/fmt';
import { runHttpSmokeTests } from '../lib/smoke-tests';
import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { readTfOutputs, requireOutput } from '../lib/tf-outputs';
import { TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import {
  fetchDopplerSecret,
  getSecretMap,
  validateSecret,
} from '../secrets/secrets';
import { run, runCapture } from '../subprocess';
import type { Command } from './types';

export class DeployCommand implements Command {
  readonly id = 'deploy';
  readonly summary =
    'Full idempotent deploy: validate → terraform → apps → smoke tests';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Deploy');

    // ── 1. Ensure secrets ───────────────────────────────────────────────
    heading('Secrets');
    this.ensureSecrets();

    // ── 2. Validate ─────────────────────────────────────────────────────
    heading('Validate');
    await runStep(this.platform, 'Wrangler auth', () =>
      this.assertWranglerAuth()
    );
    await runStep(this.platform, 'Validate secrets', () =>
      this.validateSecrets()
    );

    // ── 3. Terraform init + apply ───────────────────────────────────────
    heading('Terraform');
    await runStep(this.platform, 'Terraform init', () =>
      run(this.platform, 'terraform', ['init', '-input=false'], {
        cwd: TF_PACKAGE_ROOT,
        label: 'Terraform init',
      })
    );
    await runStep(this.platform, 'Terraform validate', () =>
      run(this.platform, 'terraform', ['validate'], {
        cwd: TF_PACKAGE_ROOT,
        label: 'Terraform validate',
      })
    );
    await runStep(this.platform, 'Terraform apply', () =>
      run(
        this.platform,
        'terraform',
        [
          'apply',
          '-auto-approve',
          '-input=false',
          '-lock-timeout=120s',
          ...TF_DEPLOY_VAR_ARGS,
        ],
        { cwd: TF_PACKAGE_ROOT, label: 'Terraform apply' }
      )
    );

    // ── 4. Deploy apps ──────────────────────────────────────────────────
    heading('Apps');
    const outputs = readTfOutputs(this.platform);
    const registry = createDeployRegistry(this.platform);
    for (const deployable of registry) {
      await runStep(this.platform, `Deploy: ${deployable.id}`, () =>
        deployable.deploy(outputs)
      );
    }

    // ── 5. Smoke tests ──────────────────────────────────────────────────
    heading('Smoke tests');
    await runHttpSmokeTests(this.platform, outputs);

    // ── Done ────────────────────────────────────────────────────────────
    banner('Deploy Complete');
    for (const key of ['client_url', 'api_url'] as const) {
      try {
        ok(key, requireOutput(this.platform, outputs, key));
      } catch {
        /* output not available */
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private ensureSecrets(): void {
    const secretMap = getSecretMap();
    let loaded = 0;
    let alreadySet = 0;
    let failed = 0;

    for (const { doppler, env } of secretMap) {
      if (process.env[env]) {
        alreadySet++;
        continue;
      }
      try {
        const value = fetchDopplerSecret(doppler);
        process.env[env] = value;
        loaded++;
      } catch {
        this.platform.warning(`${env} — not in env and Doppler fetch failed`);
        failed++;
      }
    }

    if (alreadySet > 0) ok('Secrets in env', String(alreadySet));
    if (loaded > 0) ok('Loaded from Doppler', String(loaded));
    if (failed > 0) {
      this.platform.warning(
        `${failed} secret(s) unavailable — deploy may fail`
      );
    }
  }

  private assertWranglerAuth(): void {
    const whoami = runCapture('wrangler', ['whoami']);
    this.platform.notice(`Wrangler identity: ${whoami}`);
  }

  private async validateSecrets(): Promise<void> {
    const secretMap = getSecretMap();
    const errors: string[] = [];

    for (const entry of secretMap) {
      const value = process.env[entry.env];
      if (!value) continue;
      const err = await validateSecret(entry, value);
      if (err) {
        this.platform.error(`${entry.doppler}: ${err}`);
        errors.push(entry.doppler);
      } else {
        ok(entry.doppler);
      }
    }

    assert.ok(
      errors.length === 0,
      `Secret validation failed for: ${errors.join(', ')}`
    );
  }
}
