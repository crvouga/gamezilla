import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { assert } from '@gamezilla/shared/assert';
import { join } from 'node:path';
import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { runStep } from '../platform';
import { run } from '../subprocess';
import { ensureAwsEnvCredentials, requireAwsRegion } from '../lib/aws-creds';
import { PROJECT_CONFIG } from '../../project-config';
import { REPO_ROOT, TF_PACKAGE_ROOT, INFRA_CLI_ROOT } from '../paths';

function isValidAwsRegionFormat(value: string): boolean {
  return /^[a-z]{2}-[a-z]+-\d$/.test(value.trim());
}

export class PreflightCommand implements Command {
  readonly id = 'preflight';
  readonly summary = 'Validate AWS, terraform, Docker builds';
  readonly group = 'ci' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    process.env['AWS_REGION'] = process.env['AWS_REGION'] ?? PROJECT_CONFIG.aws.region;
    ensureAwsEnvCredentials();
    const region = this.requireAwsRegionValid();
    await runStep(this.platform, 'PREFLIGHT 1/5 — AWS caller identity', () =>
      this.assertCallerIdentity(region),
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
