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
  FORBIDDEN_STATUSES,
  MAX_POLLS,
  POLL_MS,
  STACK_NAME,
  TRANSIENT_STATUSES,
  TERMINAL_FAILURE_DURING_WAIT,
  describeStack,
  reasonIsSet,
} from './cfn-shared';
import { ghError, ghNotice } from './gh';

export class CfnGateCommand extends BaseCiCommand {
  readonly id = 'gate';
  readonly summary =
    'CloudFormation gate (wait for stable / classify; never cancel updates)';

  async execute(argv: string[]): Promise<void> {
    assert(Array.isArray(argv));
    const client = cloudFormation();
    assert(client !== undefined && client !== null);
    const d = await describeStack(client);
    if (d === null) {
      await this.assertDeployableOrAbsent(client);
      return;
    }

    const status = d.status;
    if (status === undefined || status === '') {
      ghError('Stack status empty after describe.');
      process.exit(1);
    }

    if (DEPLOYABLE_STATUSES.has(status)) {
      await this.assertDeployableOrAbsent(client);
      return;
    }

    if (FORBIDDEN_STATUSES.has(status)) {
      ghError(
        `FORBIDDEN state for CDK: ${STACK_NAME} is ${status} — resolve in AWS first.`
      );
      await this.dumpStackEvents(client);
      process.exit(1);
    }

    if (status === 'UPDATE_IN_PROGRESS') {
      ghNotice(
        `${STACK_NAME} is UPDATE_IN_PROGRESS — waiting for completion (no cancel-update-stack).`
      );
      await this.waitForStable(client);
      await this.assertDeployableOrAbsent(client);
      return;
    }

    if (TRANSIENT_STATUSES.has(status)) {
      ghNotice(`${STACK_NAME} is ${status} — waiting (no cancel).`);
      await this.waitForStable(client);
      await this.assertDeployableOrAbsent(client);
      return;
    }

    if (status === 'REVIEW_IN_PROGRESS') {
      ghError(
        `FORBIDDEN: ${STACK_NAME} REVIEW_IN_PROGRESS — execute or delete the change set in Console.`
      );
      process.exit(1);
    }

    ghError(
      `UNCLASSIFIED CloudFormation status: ${STACK_NAME}=${status} — add handling in scripts/ci/cmd-gate.ts (fail closed).`
    );
    try {
      const full = await client.send(
        new DescribeStacksCommand({ StackName: STACK_NAME })
      );
      console.error(JSON.stringify(full.Stacks?.[0] ?? {}, null, 2));
    } catch {
      /* ignore */
    }
    process.exit(1);
  }

  private async assertDeployableOrAbsent(
    client: CloudFormationClient
  ): Promise<void> {
    assert(client !== undefined && client !== null);
    const row = await describeStack(client);
    if (row === null) {
      ghNotice(`ASSERT ok: stack absent — CDK may CREATE ${STACK_NAME}`);
      return;
    }
    const { status, reason } = row;
    if (status === undefined || status === '') {
      ghError(`ASSERT failed: ${STACK_NAME} describe returned empty status.`);
      process.exit(1);
    }
    if (!DEPLOYABLE_STATUSES.has(status)) {
      ghError(
        `ASSERT failed: ${STACK_NAME} status=${status} is NOT deployable — invariant violated.`
      );
      process.exit(1);
    }
    if (reasonIsSet(reason)) {
      ghError(
        `ASSERT failed: ${STACK_NAME} status=${status} but StackStatusReason=${reason} — human fix required.`
      );
      process.exit(1);
    }
    assert(DEPLOYABLE_STATUSES.has(status));
    assert(!reasonIsSet(reason));
    ghNotice(
      `ASSERT ok: ${STACK_NAME} status=${status} — safe for CDK deploy`
    );
  }

  private async logRecentEvents(client: CloudFormationClient): Promise<void> {
    assert(client !== undefined && client !== null);
    ghNotice('Recent stack events (debug):');
    const out = await client.send(
      new DescribeStackEventsCommand({
        StackName: STACK_NAME,
      })
    );
    console.log(
      JSON.stringify(out.StackEvents ?? [], null, 2).slice(0, 8000)
    );
  }

  private async waitForStable(client: CloudFormationClient): Promise<void> {
    assert(client !== undefined && client !== null);
    assert(MAX_POLLS > 0 && POLL_MS > 0);
    for (let i = 1; i <= MAX_POLLS; i++) {
      const row = await describeStack(client);
      if (row === null) {
        ghError(`${STACK_NAME} missing during wait.`);
        process.exit(1);
      }
      const { status } = row;
      if (status === undefined || status === '') {
        ghError('Empty stack status during wait.');
        process.exit(1);
      }
      if (DEPLOYABLE_STATUSES.has(status)) return;

      if (TERMINAL_FAILURE_DURING_WAIT.has(status)) {
        ghError(
          `${STACK_NAME} terminal failure ${status} during wait — fix in CloudFormation.`
        );
        await this.dumpStackEvents(client);
        process.exit(1);
      }
      if (status === 'DELETE_IN_PROGRESS') {
        ghError(`${STACK_NAME} is DELETE_IN_PROGRESS — cannot deploy.`);
        process.exit(1);
      }

      if (i % 10 === 0) await this.logRecentEvents(client);
      console.log(
        `Waiting for ${STACK_NAME} (status=${status}) — ${i}/${MAX_POLLS} (~30 min max)`
      );
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    ghError(`Timeout waiting for ${STACK_NAME}`);
    await this.dumpStackEvents(client);
    process.exit(1);
  }

  private async dumpStackEvents(client: CloudFormationClient): Promise<void> {
    assert(client !== undefined && client !== null);
    try {
      const out = await client.send(
        new DescribeStackEventsCommand({
          StackName: STACK_NAME,
        })
      );
      console.error(JSON.stringify(out.StackEvents ?? [], null, 2));
    } catch {
      /* ignore */
    }
  }
}
