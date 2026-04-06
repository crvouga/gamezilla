import { assert } from '@gamezilla/shared/assert';
import { join } from 'node:path';
import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { runStep } from '../platform';
import { run, runCapture } from '../subprocess';
import { TF_PACKAGE_ROOT, REPO_ROOT, INFRA_CLI_ROOT } from '../paths';

export class PreflightCommand implements Command {
  readonly id = 'preflight';
  readonly summary = 'Validate Fly.io auth, terraform, Docker builds';
  readonly group = 'ci' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    await runStep(this.platform, 'PREFLIGHT 1/5 — Fly.io auth', () =>
      this.assertFlyAuth(),
    );
    await runStep(this.platform, 'PREFLIGHT 2/5 — Terraform init', () =>
      this.terraformInit(),
    );
    await runStep(this.platform, 'PREFLIGHT 3/5 — Terraform validate', () =>
      this.terraformValidate(),
    );
    await runStep(this.platform, 'PREFLIGHT 4/5 — Docker build (app)', () =>
      this.assertDockerBuild(REPO_ROOT, 'Docker build (app)'),
    );
    await runStep(this.platform, 'PREFLIGHT 5/5 — Docker build (emqx)', () =>
      this.assertDockerBuild(join(INFRA_CLI_ROOT, 'emqx-image'), 'Docker build (emqx)'),
    );
  }

  private assertFlyAuth(): void {
    const whoami = runCapture('flyctl', ['auth', 'whoami']);
    this.platform.notice(`Fly.io identity: ${whoami}`);
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

  private assertDockerBuild(contextDir: string, label: string): void {
    run(this.platform, 'docker', ['build', '.'], {
      cwd: contextDir,
      label,
    });
    this.platform.notice(`${label} — OK.`);
  }
}
