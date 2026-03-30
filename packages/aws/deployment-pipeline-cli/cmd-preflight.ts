/* eslint-disable expo/no-dynamic-env-var */
import {
  type CloudFormationClient,
  DescribeStackEventsCommand,
  DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import assert from 'node:assert/strict';
import { cloudFormation } from './aws';
import { BasePipelineCommand } from './base-command';
import {
  DEPLOYABLE_STATUSES,
  STACK_NAME,
  describeStack,
  reasonIsSet,
} from './cfn-shared';
import { ghError, ghNotice } from './gh';
import { REPO_ROOT } from './paths';
import { run } from './run-subprocess';

function isValidAwsAccessKeyId(value: string | undefined): boolean {
  return typeof value === 'string' && /^[A-Z0-9]{20}$/.test(value.trim());
}

function isValidAwsSecretAccessKey(value: string | undefined): boolean {
  return typeof value === 'string' && /^[A-Za-z0-9/+=]{40}$/.test(value.trim());
}

function isValidAwsRegion(value: string | undefined): boolean {
  return typeof value === 'string' && /^[a-z]{2}-[a-z]+-\d$/.test(value.trim());
}

export class PreflightCommand extends BasePipelineCommand {
  readonly id = 'preflight';
  readonly summary =
    'Validate AWS secrets, assert caller identity, gate stack, Docker build — one shot';

  async execute(argv: string[]): Promise<void> {
    assert(Array.isArray(argv));

    // ── 1. Require AWS secrets ──────────────────────────────────────
    this.requireAwsSecrets();

    // ── 2. Assert caller identity (STS) ─────────────────────────────
    const region = (process.env['AWS_REGION'] ?? '').trim();
    await this.assertCallerIdentity(region);

    // ── 3. Gate: stack must be absent or deployable ─────────────────
    await this.gateStack();

    // ── 4. Docker image must build ───────────────────────────────────
    this.assertDockerBuild();
  }

  private requireAwsSecrets(): void {
    const errors: string[] = [];

    const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
    const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
    const region = process.env['AWS_REGION'];

    if (!accessKeyId || !isValidAwsAccessKeyId(accessKeyId)) {
      errors.push('AWS_ACCESS_KEY_ID (expected 20 uppercase letters/digits)');
    }
    if (!secretAccessKey || !isValidAwsSecretAccessKey(secretAccessKey)) {
      errors.push(
        'AWS_SECRET_ACCESS_KEY (expected 40 chars: letters, digits, /, +, =)'
      );
    }
    if (!region || !isValidAwsRegion(region)) {
      errors.push('AWS_REGION (expected format like "us-east-1")');
    }

    if (errors.length > 0) {
      ghError(
        `Missing, empty, or invalid Actions secrets: ${errors.join(', ')}`
      );
      assert.fail(
        `preflight: missing or invalid ${errors.join(', ')} — crash, do not continue`
      );
    }

    assert(errors.length === 0);
    ghNotice('PREFLIGHT 1/4: AWS deploy secrets present and valid.');
  }

  private async assertCallerIdentity(region: string): Promise<void> {
    assert(region.length > 0);
    const sts = new STSClient({ region });
    const id = await sts.send(new GetCallerIdentityCommand({}));
    assert(id !== undefined && id !== null && typeof id === 'object');
    console.log(
      JSON.stringify(
        { Account: id.Account, Arn: id.Arn, UserId: id.UserId },
        null,
        2
      )
    );
    if (id.Account === undefined || id.Account === '') {
      ghError('STS Account missing');
      assert.fail('preflight: STS Account must be present');
    }
    if (id.Arn === undefined || id.Arn === '') {
      ghError('STS Arn missing');
      assert.fail('preflight: STS Arn must be present');
    }
    assert(id.Account.length > 0);
    assert(id.Arn.length > 0);
    ghNotice(
      `PREFLIGHT 2/4: caller ${id.Arn} account=${id.Account} region=${region}`
    );
  }

  private async gateStack(): Promise<void> {
    const client = cloudFormation();
    assert(client !== undefined && client !== null);

    const d = await describeStack(client);

    if (d === null) {
      ghNotice(`PREFLIGHT 3/4: ${STACK_NAME} absent — CDK will CREATE.`);
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

    assert(DEPLOYABLE_STATUSES.has(status));
    assert(!reasonIsSet(reason));
    ghNotice(
      `PREFLIGHT 3/4: ${STACK_NAME} status=${status} — safe for CDK deploy.`
    );
  }

  private async failWithEvents(
    client: CloudFormationClient,
    message: string
  ): Promise<never> {
    assert(client !== undefined && client !== null);
    assert(typeof message === 'string' && message.length > 0);

    ghError(message);

    try {
      const events = await client.send(
        new DescribeStackEventsCommand({ StackName: STACK_NAME })
      );
      const items = events.StackEvents ?? [];
      assert(Array.isArray(items));
      console.error(`--- ${STACK_NAME} recent events (${items.length}) ---`);
      console.error(JSON.stringify(items.slice(0, 25), null, 2));
    } catch (evtErr: unknown) {
      ghError(
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
      ghError(
        `Additionally failed to describe stack: ${String(descErr instanceof Error ? descErr.message : descErr)}`
      );
    }

    assert.fail(message);
  }

  private assertDockerBuild(): void {
    run('docker', ['build', '--quiet', '.'], { cwd: REPO_ROOT });
    ghNotice('PREFLIGHT 4/4: Docker image builds successfully.');
  }
}
