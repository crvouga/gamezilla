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
    await runStep(this.platform, 'PREFLIGHT 1/6 — AWS caller identity', () =>
      this.assertCallerIdentity(region),
    );
    await runStep(this.platform, 'PREFLIGHT 2/6 — DynamoDB lock table access', () =>
      this.assertTfLockTableAccess(region),
    );
    await runStep(this.platform, 'PREFLIGHT 3/6 — Terraform init', () =>
      this.terraformInit(),
    );
    await runStep(this.platform, 'PREFLIGHT 4/6 — Terraform validate', () =>
      this.terraformValidate(),
    );
    await runStep(this.platform, 'PREFLIGHT 5/6 — Docker build (app)', () =>
      this.assertDockerBuild(REPO_ROOT, 'Docker build (app)'),
    );
    await runStep(this.platform, 'PREFLIGHT 6/6 — Docker build (emqx)', () =>
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

  private async assertTfLockTableAccess(region: string): Promise<void> {
    const { DynamoDBClient, GetItemCommand } = await import('@aws-sdk/client-dynamodb');
    const table = PROJECT_CONFIG.tfBackend.dynamodbTable;
    const client = new DynamoDBClient({ region });
    try {
      await client.send(new GetItemCommand({
        TableName: table,
        Key: { LockID: { S: '__preflight_probe__' } },
      }));
    } catch (e: unknown) {
      const code = (e as { name?: string }).name ?? '';
      const msg = e instanceof Error ? e.message : String(e);
      if (code === 'AccessDeniedException' || msg.includes('AccessDeniedException') || msg.includes('not authorized')) {
        this.platform.error(`DynamoDB lock table "${table}" is NOT accessible — Terraform will fail to acquire the state lock.`);
        this.platform.error('The IAM role needs dynamodb:GetItem, dynamodb:PutItem, and dynamodb:DeleteItem');
        this.platform.error(`on arn:aws:dynamodb:${region}:*:table/${table}`);
        assert.fail(`preflight: DynamoDB lock table "${table}" is not accessible — crash, do not continue`);
      }
      if (code === 'ResourceNotFoundException' || msg.includes('ResourceNotFoundException') || msg.includes('not found')) {
        this.platform.error(`DynamoDB lock table "${table}" does not exist in ${region}.`);
        this.platform.error('Run "bun run infra bootstrap" to create the Terraform backend resources.');
        assert.fail(`preflight: DynamoDB lock table "${table}" not found — crash, do not continue`);
      }
      throw e;
    }
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

  private assertDockerBuild(contextDir: string, label: string): void {
    run(this.platform, 'docker', ['build', '.'], {
      cwd: contextDir,
      label,
    });
    this.platform.notice(`${label} — OK.`);
  }
}
