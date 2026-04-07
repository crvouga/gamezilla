import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { run } from '../subprocess';
import type { Command } from './types';

/**
 * Runs Terraform init + apply. Worker deployment is handled separately by
 * {@link WorkersDeployable} in the deploy registry.
 */
export class ApplyCommand implements Command {
  readonly id = 'ci-apply';
  readonly summary = 'Terraform init + apply';
  private readonly tfVarOverrides: readonly string[] | undefined;

  constructor(
    private readonly platform: CiPlatform,
    opts?: { tfVarOverrides?: readonly string[] }
  ) {
    this.tfVarOverrides = opts?.tfVarOverrides;
  }

  async execute(): Promise<void> {
    await runStep(this.platform, 'Terraform init', () => this.terraformInit());
    await runStep(this.platform, 'Terraform apply', () =>
      this.terraformApply()
    );
  }

  private terraformInit(): void {
    run(this.platform, 'terraform', ['init', '-input=false'], {
      cwd: TF_PACKAGE_ROOT,
      label: 'Terraform init',
    });
  }

  private terraformApply(): void {
    const varArgs = this.tfVarOverrides ?? TF_DEPLOY_VAR_ARGS;
    run(
      this.platform,
      'terraform',
      [
        'apply',
        '-auto-approve',
        '-input=false',
        '-lock-timeout=120s',
        ...varArgs,
      ],
      { cwd: TF_PACKAGE_ROOT, label: 'Terraform apply' }
    );
    this.platform.notice('Terraform apply finished.');
  }
}
