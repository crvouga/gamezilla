import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { assert } from '@gamezilla/shared/assert';
import { cloudFormation, requireAwsRegion } from './aws';
import { BasePipelineCommand } from './base-command';
import type { CiPlatform } from './ci-platform';
import { runStep } from './ci-platform';
import {
  DEPLOYABLE_STATUSES,
  STACK_NAME,
  describeStack,
  failWithEvents,
  reasonIsSet,
} from './cfn-shared';
import { PROJECT_CONFIG } from '../project-config';
import { CDK_DEPLOY_CONTEXT_ARGS } from './cdk-deploy-context';
import { join } from 'node:path';
import { AWS_PACKAGE_ROOT, REPO_ROOT } from './paths';
import { run } from './run-subprocess';

function isValidAwsRegionFormat(value: string): boolean {
  return typeof value === 'string' && /^[a-z]{2}-[a-z]+-\d$/.test(value.trim());
}

export class PreflightCommand extends BasePipelineCommand {
  readonly id = 'preflight';
  readonly summary =
    'Validate AWS (STS), stack gate, CDK synth invariants, Docker builds (app + emqx)';

  constructor(platform: CiPlatform) {
    super(platform);
  }

  async execute(argv: string[]): Promise<void> {
    assert.array(argv, 'execute: argv must be an array');

    const region = this.requireAwsRegionValid();
    await runStep(this.platform, 'PREFLIGHT 1/5 — AWS caller identity', () =>
      this.assertCallerIdentity(region)
    );
    await runStep(this.platform, 'PREFLIGHT 2/5 — CloudFormation stack gate', () =>
      this.gateStack()
    );
    await runStep(this.platform, 'PREFLIGHT 3/5 — CDK synth', () =>
      this.assertCdkSynthMatchesDeploy()
    );
    await runStep(this.platform, 'PREFLIGHT 4/5 — Docker build (app)', () =>
      this.assertDockerBuild(REPO_ROOT, 'Docker build (app)')
    );
    await runStep(this.platform, 'PREFLIGHT 5/5 — Docker build (emqx)', () =>
      this.assertDockerBuild(join(AWS_PACKAGE_ROOT, 'emqx-image'), 'Docker build (emqx)')
    );
  }

  private requireAwsRegionValid(): string {
    const region = requireAwsRegion(this.platform).trim();
    if (!isValidAwsRegionFormat(region)) {
      this.platform.error(
        `AWS_REGION="${region}" invalid (expected format like "us-east-1").`
      );
      this.platform.error(
        'Fix: Check the aws-region input in the configure-aws-credentials step of the workflow.'
      );
      assert.fail(
        'preflight: AWS_REGION must match a valid region pattern — crash, do not continue'
      );
    }
    return region;
  }

  private async assertCallerIdentity(region: string): Promise<void> {
    assert.ok(region.length > 0, 'assertCallerIdentity: region must be non-empty');
    const sts = new STSClient({ region });
    const id = await sts.send(new GetCallerIdentityCommand({}));
    assert.defined(id, 'assertCallerIdentity: STS response must be defined');
    console.log(
      JSON.stringify(
        { Account: id.Account, Arn: id.Arn, UserId: id.UserId },
        null,
        2
      )
    );
    if (id.Account === undefined || id.Account === '') {
      this.platform.error('STS GetCallerIdentity returned no Account.');
      this.platform.error(
        'Fix: Ensure the configure-aws-credentials step succeeded and AWS_ACCESS_KEY_ID is set.'
      );
      assert.fail('preflight: STS Account must be present');
    }
    if (id.Arn === undefined || id.Arn === '') {
      this.platform.error('STS GetCallerIdentity returned no Arn.');
      this.platform.error(
        'Fix: Ensure the configure-aws-credentials step succeeded and AWS credentials are valid.'
      );
      assert.fail('preflight: STS Arn must be present');
    }
    assert.ok(id.Account.length > 0, 'preflight: Account must be non-empty');
    assert.ok(id.Arn.length > 0, 'preflight: Arn must be non-empty');

    if (this.platform.enforceDeployRole) {
      const expected = PROJECT_CONFIG.githubActionsRoleName;
      if (!id.Arn.includes(expected)) {
        this.platform.error(
          `Expected CI caller to assume role containing "${expected}", got ARN: ${id.Arn}`
        );
        this.platform.error(
          'Fix: Verify the OIDC role ARN in GitHub repo variables (Settings > Secrets and variables > Actions > AWS_ROLE_ARN).'
        );
        assert.fail(
          'preflight: CI must use OIDC deploy role — crash, do not continue'
        );
      }
    }

    this.platform.notice(
      `Caller: ${id.Arn}  Account: ${id.Account}  Region: ${region}`
    );
  }

  private async gateStack(): Promise<void> {
    const client = cloudFormation(this.platform);
    assert.defined(client, 'gateStack: CloudFormation client must be defined');

    const d = await describeStack(client);

    if (d === null) {
      this.platform.notice(`${STACK_NAME} absent — CDK will CREATE.`);
      return;
    }

    const { status, reason } = d;

    if (status === undefined || status === '') {
      return failWithEvents(
        this.platform,
        client,
        `${STACK_NAME} returned empty stack status — invariant violated.`,
        'Open the CloudFormation console and inspect the stack directly.'
      );
    }

    if (!DEPLOYABLE_STATUSES.has(status)) {
      return failWithEvents(
        this.platform,
        client,
        `${STACK_NAME} status=${status} is NOT deployable. Only ${[...DEPLOYABLE_STATUSES].join(', ')} are accepted.`,
        `Open the AWS CloudFormation console, find "${STACK_NAME}", and resolve the failed state (delete and recreate if ROLLBACK_COMPLETE).`
      );
    }

    if (reasonIsSet(reason)) {
      return failWithEvents(
        this.platform,
        client,
        `${STACK_NAME} status=${status} but StackStatusReason="${reason}" — previous operation left a warning.`,
        `Open the AWS CloudFormation console, inspect "${STACK_NAME}", and resolve the warning before re-deploying.`
      );
    }

    assert.ok(DEPLOYABLE_STATUSES.has(status), 'gateStack: status must be deployable');
    assert.ok(!reasonIsSet(reason), 'gateStack: reason must not be set');
    this.platform.notice(
      `${STACK_NAME} status=${status} — safe for CDK deploy.`
    );
  }

  private assertCdkSynthMatchesDeploy(): void {
    run(
      this.platform,
      'bunx',
      ['cdk', 'synth', ...CDK_DEPLOY_CONTEXT_ARGS, '-q'],
      { cwd: AWS_PACKAGE_ROOT, label: 'CDK synth (deploy context)' }
    );
    this.platform.notice(
      'Template synthesized with deploy context — resource precondition asserts ran.'
    );
  }

  private assertDockerBuild(contextDir: string, label: string): void {
    run(this.platform, 'docker', ['build', '.'], {
      cwd: contextDir,
      label,
    });
    this.platform.notice(`${label} — OK.`);
  }
}
