import { join } from 'node:path';
import { REPO_ROOT, TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { run, runCapture, runSafe } from '../subprocess';
import type { Command } from './types';

/**
 * Wrangler reads CLOUDFLARE_ACCOUNT_ID to skip /memberships account discovery
 * (which fails for scoped API tokens).
 */
function wranglerEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: process.env['TF_VAR_cloudflare_account_id'],
  };
}

export class PreDeployCommand implements Command {
  readonly id = 'pre-deploy';
  readonly summary =
    'Validate Wrangler auth, PlanetScale creds, Terraform config, binding audit';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    await runStep(this.platform, 'PRE-DEPLOY 1/5 — Wrangler auth', () =>
      this.assertWranglerAuth()
    );
    await runStep(
      this.platform,
      'PRE-DEPLOY 2/5 — PlanetScale credentials',
      () => this.assertPlanetScaleCredentials()
    );
    await runStep(this.platform, 'PRE-DEPLOY 3/5 — Terraform init', () =>
      this.terraformInit()
    );
    await runStep(this.platform, 'PRE-DEPLOY 4/5 — Terraform validate', () =>
      this.terraformValidate()
    );
    await runStep(
      this.platform,
      'PRE-DEPLOY 5/5 — Wrangler binding audit',
      () => this.auditWorkerBindings()
    );
  }

  private assertPlanetScaleCredentials(): void {
    const id = process.env['PLANETSCALE_SERVICE_TOKEN_ID'];
    const token = process.env['PLANETSCALE_SERVICE_TOKEN'];
    if (!id || !token) {
      throw new Error(
        'Missing PLANETSCALE_SERVICE_TOKEN_ID and/or PLANETSCALE_SERVICE_TOKEN. ' +
          'Add them to Doppler or export them before running the pipeline.'
      );
    }
    this.platform.notice('PlanetScale service token credentials present.');
  }

  private assertWranglerAuth(): void {
    const whoami = runCapture('wrangler', ['whoami']);
    this.platform.notice(`Wrangler identity: ${whoami}`);
  }

  private terraformInit(): void {
    run(this.platform, 'terraform', ['init', '-input=false'], {
      cwd: TF_PACKAGE_ROOT,
      label: 'Terraform init',
    });
  }

  private terraformValidate(): void {
    run(this.platform, 'terraform', ['validate'], {
      cwd: TF_PACKAGE_ROOT,
      label: 'Terraform validate',
    });
    this.platform.notice('Terraform configuration is valid.');
  }

  /**
   * List existing Worker secrets and warn if names that the deploy will set as
   * secrets already exist — catches "Binding name already in use" (10053)
   * before the deploy step.
   */
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
