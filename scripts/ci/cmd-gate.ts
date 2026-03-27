import assert from 'node:assert/strict';
import {
  type CloudFormationClient,
  DescribeStackEventsCommand,
  DescribeStacksCommand,
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

export class CfnGateCommand extends BaseCiCommand {
  readonly id = 'gate';
  readonly summary =
    'Assert stack is absent or deployable — fail fast on anything else';

  async execute(argv: string[]): Promise<void> {
    assert(Array.isArray(argv));
    const client = cloudFormation();
    assert(client !== undefined && client !== null);

    const d = await describeStack(client);

    if (d === null) {
      ghNotice(`GATE ok: ${STACK_NAME} absent — CDK will CREATE.`);
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
    ghNotice(`GATE ok: ${STACK_NAME} status=${status} — safe for CDK deploy.`);
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
      console.error(
        `--- ${STACK_NAME} recent events (${items.length}) ---`
      );
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
}
