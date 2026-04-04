import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { assert } from '@gamezilla/shared/assert';
import { requireAwsRegion } from './aws';
import { BasePipelineCommand } from './base-command';
import type { CiPlatform } from './ci-platform';
import { runStep } from './ci-platform';
import { PROJECT_CONFIG } from '../project-config';
import { REPO_ROOT, TF_PACKAGE_ROOT } from './paths';
import { run } from './run-subprocess';

function isValidAwsRegionFormat(value: string): boolean {
  return /^[a-z]{2}-[a-z]+-\d$/.test(value.trim());
}

export class PreflightCommand extends BasePipelineCommand {
  readonly id = 'preflight';
  readonly summary =
    'Validate AWS (STS), terraform validate, Docker build';

  constructor(platform: CiPlatform) {
    super(platform);
  }

  async execute(argv: string[]): Promise<void> {
    assert.array(argv, 'execute: argv must be an array');

    const region = this.requireAwsRegionValid();
    await runStep(this.platform, 'PREFLIGHT 1/4 — AWS caller identity', () =>
      this.assertCallerIdentity(region)
    );
    await runStep(this.platform, 'PREFLIGHT 2/4 — Terraform init', () =>
      this.terraformInit()
    );
    await runStep(this.platform, 'PREFLIGHT 3/4 — Terraform validate', () =>
      this.terraformValidate()
    );
    await runStep(this.platform, 'PREFLIGHT 4/4 — Docker build', () =>
      this.assertDockerBuild()
    );
  }

  private requireAwsRegionValid(): string {
    const region = requireAwsRegion(this.platform).trim();
    if (!isValidAwsRegionFormat(region)) {
      this.platform.error(`AWS_REGION="${region}" invalid (expected format like "us-east-1").`);
      assert.fail('preflight: AWS_REGION must match a valid region pattern');
    }
    return region;
  }

  private async assertCallerIdentity(region: string): Promise<void> {
    const sts = new STSClient({ region });
    const id = await sts.send(new GetCallerIdentityCommand({}));
    console.log(JSON.stringify({ Account: id.Account, Arn: id.Arn, UserId: id.UserId }, null, 2));

    if (!id.Account || !id.Arn) {
      this.platform.error('STS GetCallerIdentity returned no Account/Arn.');
      assert.fail('preflight: STS identity must be present');
    }

    if (this.platform.enforceDeployRole) {
      const expected = PROJECT_CONFIG.githubActionsRoleName;
      if (!id.Arn.includes(expected)) {
        this.platform.error(`Expected CI caller to assume role containing "${expected}", got ARN: ${id.Arn}`);
        assert.fail('preflight: CI must use OIDC deploy role');
      }
    }

    this.platform.notice(`Caller: ${id.Arn}  Account: ${id.Account}  Region: ${region}`);
  }

  private terraformInit(): void {
    run(this.platform, 'terraform', ['init', '-input=false', '-reconfigure'], {
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

  private assertDockerBuild(): void {
    run(this.platform, 'docker', ['build', '.'], {
      cwd: REPO_ROOT,
      label: 'Docker build (app)',
    });
    this.platform.notice('Docker image builds successfully.');
  }
}
