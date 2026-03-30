import {
  type CloudFormationClient,
  DescribeStackEventsCommand,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { assert } from '@gamezilla/shared/assert';
import { cloudFormation, requireAwsRegion } from './aws';
import { BasePipelineCommand } from './base-command';
import type { CiPlatform } from './ci-platform';
import {
  DEPLOYABLE_STATUSES,
  STACK_NAME,
  describeStack,
  reasonIsSet,
} from './cfn-shared';
import { PROJECT_CONFIG } from '../project-config';
import { REPO_ROOT } from './paths';
import { run } from './run-subprocess';

function isValidAwsRegionFormat(value: string): boolean {
  return typeof value === 'string' && /^[a-z]{2}-[a-z]+-\d$/.test(value.trim());
}

export class PreflightCommand extends BasePipelineCommand {
  readonly id = 'preflight';
  readonly summary =
    'Validate AWS credentials (STS), gate stack, Docker build — one shot';

  constructor(platform: CiPlatform) {
    super(platform);
  }

  async execute(argv: string[]): Promise<void> {
    assert.array(argv, 'execute: argv must be an array');

    const region = this.requireAwsRegionValid();
    await this.assertCallerIdentity(region);
    await this.gateStack();
    this.assertDockerBuild();
  }

  private requireAwsRegionValid(): string {
    const region = requireAwsRegion(this.platform).trim();
    if (!isValidAwsRegionFormat(region)) {
      this.platform.error('AWS_REGION invalid (expected format like "us-east-1")');
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
      this.platform.error('STS Account missing');
      assert.fail('preflight: STS Account must be present');
    }
    if (id.Arn === undefined || id.Arn === '') {
      this.platform.error('STS Arn missing');
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
        assert.fail(
          'preflight: CI must use OIDC deploy role — crash, do not continue'
        );
      }
    }

    this.platform.notice(
      `PREFLIGHT 1/3: caller ${id.Arn} account=${id.Account} region=${region}`
    );
  }

  private async gateStack(): Promise<void> {
    const client = cloudFormation(this.platform);
    assert.defined(client, 'gateStack: CloudFormation client must be defined');

    const d = await describeStack(client);

    if (d === null) {
      this.platform.notice(`PREFLIGHT 2/3 (stack): ${STACK_NAME} absent — CDK will CREATE.`);
      return;
    }

    const { status, reason } = d;

    if (status === undefined || status === '') {
      return this.failWithEvents(
        client,
        `${STACK_NAME} returned empty stack status — invariant violated.`
      );
    }

    if (!DEPLOYABLE_STATUSES.has(status)) {
      return this.failWithEvents(
        client,
        `${STACK_NAME} status=${status} is NOT deployable. Only ${[...DEPLOYABLE_STATUSES].join(', ')} are accepted. Fix the stack in AWS Console, then re-run.`
      );
    }

    if (reasonIsSet(reason)) {
      return this.failWithEvents(
        client,
        `${STACK_NAME} status=${status} but StackStatusReason="${reason}" — previous operation left a warning. Resolve in AWS Console.`
      );
    }

    assert.ok(DEPLOYABLE_STATUSES.has(status), 'gateStack: status must be deployable');
    assert.ok(!reasonIsSet(reason), 'gateStack: reason must not be set');
    this.platform.notice(
      `PREFLIGHT 2/3 (stack): ${STACK_NAME} status=${status} — safe for CDK deploy.`
    );
  }

  private async failWithEvents(
    client: CloudFormationClient,
    message: string
  ): Promise<never> {
    assert.defined(client, 'failWithEvents: client is required');
    assert.ok(typeof message === 'string' && message.length > 0, 'failWithEvents: message must be non-empty');

    this.platform.error(message);

    try {
      const events = await client.send(
        new DescribeStackEventsCommand({ StackName: STACK_NAME })
      );
      const items = events.StackEvents ?? [];
      assert.array(items, 'failWithEvents: StackEvents must be an array');
      console.error(`--- ${STACK_NAME} recent events (${items.length}) ---`);
      console.error(JSON.stringify(items.slice(0, 25), null, 2));
    } catch (evtErr: unknown) {
      this.platform.error(
        `Additionally failed to fetch stack events: ${String(evtErr instanceof Error ? evtErr.message : evtErr)}`
      );
    }

    try {
      const full = await client.send(
        new DescribeStacksCommand({ StackName: STACK_NAME })
      );
      const stack = full.Stacks?.[0];
      if (stack !== undefined) {
        console.error(`--- ${STACK_NAME} full describe ---`);
        console.error(JSON.stringify(stack, null, 2));
      }
    } catch (descErr: unknown) {
      this.platform.error(
        `Additionally failed to describe stack: ${String(descErr instanceof Error ? descErr.message : descErr)}`
      );
    }

    assert.fail(message);
  }

  private assertDockerBuild(): void {
    run(this.platform, 'docker', ['build', '--quiet', '.'], { cwd: REPO_ROOT });
    this.platform.notice('PREFLIGHT 3/3 (docker): Docker image builds successfully.');
  }
}
