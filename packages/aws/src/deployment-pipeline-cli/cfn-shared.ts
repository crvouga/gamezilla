import {
  DescribeStacksCommand,
  type CloudFormationClient,
} from '@aws-sdk/client-cloudformation';
import { assert } from '@gamezilla/shared/assert';
import { PROJECT_CONFIG } from '../project-config';

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
