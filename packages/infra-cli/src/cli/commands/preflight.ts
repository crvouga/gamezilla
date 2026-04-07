import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { runStep } from '../platform';
import { run, runCapture } from '../subprocess';
import { TF_PACKAGE_ROOT } from '../paths';

export class PreflightCommand implements Command {
  readonly id = 'preflight';
  readonly summary = 'Validate Wrangler auth, PlanetScale creds, Terraform config';
  readonly group = 'ci' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    await runStep(this.platform, 'PREFLIGHT 1/4 — Wrangler auth', () =>
      this.assertWranglerAuth(),
    );
    await runStep(this.platform, 'PREFLIGHT 2/4 — PlanetScale credentials', () =>
      this.assertPlanetScaleCredentials(),
    );
    await runStep(this.platform, 'PREFLIGHT 3/4 — Terraform init', () =>
      this.terraformInit(),
    );
    await runStep(this.platform, 'PREFLIGHT 4/4 — Terraform validate', () =>
      this.terraformValidate(),
    );
  }

  private assertPlanetScaleCredentials(): void {
    const id = process.env['PLANETSCALE_SERVICE_TOKEN_ID'];
    const token = process.env['PLANETSCALE_SERVICE_TOKEN'];
    if (!id || !token) {
      throw new Error(
        'Missing PLANETSCALE_SERVICE_TOKEN_ID and/or PLANETSCALE_SERVICE_TOKEN. ' +
        'Add them to Doppler or export them before running the pipeline.',
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
