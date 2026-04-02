import {
  DescribeStackEventsCommand,
  DescribeStacksCommand,
  type CloudFormationClient,
  type StackEvent,
} from '@aws-sdk/client-cloudformation';
import { assert } from '@gamezilla/shared/assert';
import { PROJECT_CONFIG } from '../project-config';
import type { CiPlatform } from './ci-platform';

export const STACK_NAME = PROJECT_CONFIG.stack.name;

assert.ok(STACK_NAME.length > 0, 'STACK_NAME must be non-empty');

export const DEPLOYABLE_STATUSES = new Set([
  'UPDATE_COMPLETE',
  'CREATE_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE',
  'ROLLBACK_COMPLETE',
  'IMPORT_COMPLETE',
  'IMPORT_ROLLBACK_COMPLETE',
]);

assert.ok(
  DEPLOYABLE_STATUSES.size > 0,
  'DEPLOYABLE_STATUSES must not be empty'
);

function isStackMissingError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('name' in e)) return false;
  const name = (e as { name?: string }).name;
  if (name !== 'ValidationError') return false;
  const msg =
    'message' in e && typeof (e as { message?: string }).message === 'string'
      ? (e as { message: string }).message
      : '';
  return msg.includes('does not exist');
}

export async function describeStack(
  client: CloudFormationClient
): Promise<{ status?: string; reason?: string } | null> {
  assert.defined(client, 'describeStack: client is required');
  try {
    const out = await client.send(
      new DescribeStacksCommand({ StackName: STACK_NAME })
    );
    const s = out.Stacks?.[0];
    if (s === undefined) {
      return null;
    }
    assert.ok(
      out.Stacks !== undefined && out.Stacks.length > 0,
      'describeStack: expected at least one stack'
    );
    const row: { status?: string; reason?: string } = {};
    if (s.StackStatus !== undefined) row.status = s.StackStatus;
    if (s.StackStatusReason !== undefined) row.reason = s.StackStatusReason;
    return row;
  } catch (e: unknown) {
    if (isStackMissingError(e)) return null;
    throw e;
  }
}

export function reasonIsSet(reason: string | undefined): boolean {
  if (reason === undefined || reason === '') return false;
  if (reason === 'None' || reason === 'null') return false;
  return true;
}

/**
 * Fetches recent stack events, prints a formatted failure summary with any
 * FAILED resources highlighted, then crashes the process.
 */
export async function failWithEvents(
  platform: CiPlatform,
  client: CloudFormationClient,
  message: string,
  remediation?: string
): Promise<never> {
  assert.defined(client, 'failWithEvents: client is required');
  assert.ok(typeof message === 'string' && message.length > 0, 'failWithEvents: message must be non-empty');

  platform.error(message);
  if (remediation) {
    platform.error(`Fix: ${remediation}`);
  }

  try {
    const events = await client.send(
      new DescribeStackEventsCommand({ StackName: STACK_NAME })
    );
    const items = events.StackEvents ?? [];
    assert.array(items, 'failWithEvents: StackEvents must be an array');

    const failed = items.filter((e) =>
      e.ResourceStatus?.endsWith('_FAILED')
    );

    if (failed.length > 0) {
      console.error(`\n=== ${STACK_NAME}: ${failed.length} FAILED resource(s) ===`);
      for (const evt of failed) {
        printFailedEvent(platform, evt);
      }
      console.error('');
    }

    console.error(`--- ${STACK_NAME} recent events (${items.length}) ---`);
    console.error(JSON.stringify(items.slice(0, 25), null, 2));
  } catch (evtErr: unknown) {
    platform.error(
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
    platform.error(
      `Additionally failed to describe stack: ${String(descErr instanceof Error ? descErr.message : descErr)}`
    );
  }

  assert.fail(message);
}

function printFailedEvent(platform: CiPlatform, evt: StackEvent): void {
  const resource = evt.LogicalResourceId ?? '(unknown)';
  const type = evt.ResourceType ?? '(unknown)';
  const reason = evt.ResourceStatusReason ?? '(no reason)';
  platform.error(
    `  FAILED: ${resource} (${type}) — ${reason}`
  );
}
