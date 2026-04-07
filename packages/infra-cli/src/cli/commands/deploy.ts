import { join } from 'node:path';
import { createDeployRegistry } from '../lib/deploy-registry';
import { banner, heading, ok } from '../lib/fmt';
import { runHttpSmokeTests } from '../lib/smoke-tests';
import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { readTfOutputs, requireOutput } from '../lib/tf-outputs';
import { REPO_ROOT, TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import {
  fetchDopplerSecret,
  getSecretMap,
} from '../secrets/secrets';
import { run, runCapture, runSafe } from '../subprocess';
import type { Command } from './types';

function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: process.env['TF_VAR_cloudflare_account_id'],
  };
}

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
    await runStep(this.platform, 'PlanetScale credentials', () =>
      this.assertPlanetScaleCredentials()
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
    await runStep(this.platform, 'Wrangler binding audit', () =>
      this.auditWorkerBindings()
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
    for (const key of ['web_app_url', 'api_url'] as const) {
      try {
        ok(key, requireOutput(this.platform, outputs, key));
      } catch {
        /* output not available */
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  /**
   * Idempotent: skip secrets already in env, load missing ones from Doppler.
   */
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

  private assertPlanetScaleCredentials(): void {
    const id = process.env['PLANETSCALE_SERVICE_TOKEN_ID'];
    const token = process.env['PLANETSCALE_SERVICE_TOKEN'];
    if (!id || !token) {
      throw new Error(
        'Missing PLANETSCALE_SERVICE_TOKEN_ID and/or PLANETSCALE_SERVICE_TOKEN. ' +
          'Add them to Doppler or export them before deploying.'
      );
    }
    this.platform.notice('PlanetScale service token credentials present.');
  }

  private auditWorkerBindings(): void {
    const apiDir = join(REPO_ROOT, 'packages/api');
    const env = wranglerEnv();
    const secretNames = new Set(['DATABASE_URL']);

    const result = runSafe('wrangler', ['secret', 'list', '--format=json'], {
      cwd: apiDir,
      env,
    });

    if (result.exitCode !== 0) {
      this.platform.warning(
        `Could not list Worker secrets (exit ${result.exitCode}). ` +
          'Binding conflicts will only be caught at deploy time.'
      );
      return;
    }

    let bindings: Array<{ name?: string; type?: string }>;
    try {
      bindings = JSON.parse(result.stdout);
    } catch {
      this.platform.warning(
        'Could not parse wrangler secret list output. ' +
          'Binding conflicts will only be caught at deploy time.'
      );
      return;
    }

    const conflicts = bindings.filter(
      (b) => b.name && secretNames.has(b.name) && b.type !== 'secret_text'
    );

    if (conflicts.length > 0) {
      const names = conflicts.map((b) => `${b.name} (${b.type})`).join(', ');
      this.platform.warning(
        `Binding conflict detected: ${names}. ` +
          'These exist as non-secret bindings but deploy will set them as secrets. ' +
          'The deploy step will attempt to clear them automatically.'
      );
    }

    this.platform.notice(
      `Worker binding audit passed (${bindings.length} existing binding(s)).`
    );
  }
}
