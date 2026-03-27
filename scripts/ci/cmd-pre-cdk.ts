import assert from 'node:assert/strict';
import {
  DescribeStackEventsCommand,
  type CloudFormationClient,
} from '@aws-sdk/client-cloudformation';
import { BaseCiCommand } from './base-command';
import { cloudFormation } from './aws';
import {
  DEPLOYABLE_STATUSES,
  STACK_NAME,
  describeStack,
  reasonIsSet,
} from './cfn-shared';
import { ghError, ghNotice } from './gh';

export class PreCdkCommand extends BaseCiCommand {
  readonly id = 'pre-cdk';
  readonly summary = 'Assert stack deployable immediately before CDK (fail fast)';

  async execute(argv: string[]): Promise<void> {
    assert(Array.isArray(argv));
    const client = cloudFormation();
    assert(client !== undefined && client !== null);

    const d = await describeStack(client);
    if (d === null) {
      ghNotice('ASSERT ok: stack absent — CDK create path.');
      return;
    }

    const { status, reason } = d;

    if (status === undefined || !DEPLOYABLE_STATUSES.has(status)) {
      return this.failWithEvents(
        client,
        `pre-CDK: ${STACK_NAME} status=${status ?? 'undefined'} is NOT deployable. Expected one of: ${[...DEPLOYABLE_STATUSES].join(', ')}.`
      );
    }

    if (reasonIsSet(reason)) {
      return this.failWithEvents(
        client,
        `pre-CDK: ${STACK_NAME} status=${status} but StackStatusReason="${reason}" — resolve in AWS Console.`
      );
    }

    assert(DEPLOYABLE_STATUSES.has(status));
    assert(!reasonIsSet(reason));
    ghNotice(`ASSERT ok: pre-CDK status=${status}`);
  }

  private async failWithEvents(
    client: CloudFormationClient,
    message: string
  ): Promise<never> {
    ghError(message);
    try {
      const events = await client.send(
        new DescribeStackEventsCommand({ StackName: STACK_NAME })
      );
      console.error(JSON.stringify((events.StackEvents ?? []).slice(0, 25), null, 2));
    } catch (evtErr: unknown) {
      ghError(
        `Additionally failed to fetch stack events: ${String(evtErr instanceof Error ? evtErr.message : evtErr)}`
      );
    }
    assert.fail(message);
  }
}
