import { TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { run, runCapture } from '../subprocess';
import type { Command } from './types';

export class PreDeployCommand implements Command {
  readonly id = 'ci-pre-deploy';
  readonly summary =
    'Validate Wrangler auth, PlanetScale creds, Terraform config';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    await runStep(this.platform, 'PRE-DEPLOY 1/4 — Wrangler auth', () =>
      this.assertWranglerAuth()
    );
    await runStep(
      this.platform,
      'PRE-DEPLOY 2/4 — PlanetScale credentials',
      () => this.assertPlanetScaleCredentials()
    );
    await runStep(this.platform, 'PRE-DEPLOY 3/4 — Terraform init', () =>
      this.terraformInit()
    );
    await runStep(this.platform, 'PRE-DEPLOY 4/4 — Terraform validate', () =>
      this.terraformValidate()
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
}
