import assert from 'node:assert/strict';
import {
  DescribeStacksCommand,
  type CloudFormationClient,
} from '@aws-sdk/client-cloudformation';

export const STACK_NAME = 'GamezillaStack';
export const SYNC_URL_DELIM = 'CDK_SYNC_URL_EOF';
export const POLL_MS = 15_000;
export const MAX_POLLS = 120;

assert(STACK_NAME.length > 0);
assert(SYNC_URL_DELIM.length > 0);
assert(POLL_MS > 0);
assert(MAX_POLLS > 0);

export const DEPLOYABLE_STATUSES = new Set([
  'UPDATE_COMPLETE',
  'CREATE_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE',
  'ROLLBACK_COMPLETE',
  'IMPORT_COMPLETE',
  'IMPORT_ROLLBACK_COMPLETE',
]);

export const FORBIDDEN_STATUSES = new Set([
  'DELETE_IN_PROGRESS',
  'DELETE_FAILED',
  'DELETE_COMPLETE',
  'UPDATE_ROLLBACK_FAILED',
  'UPDATE_FAILED',
  'CREATE_FAILED',
  'ROLLBACK_FAILED',
  'IMPORT_ROLLBACK_FAILED',
]);

export const TRANSIENT_STATUSES = new Set([
  'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS',
  'CREATE_IN_PROGRESS',
  'CREATE_PENDING',
  'UPDATE_ROLLBACK_IN_PROGRESS',
  'ROLLBACK_IN_PROGRESS',
  'IMPORT_IN_PROGRESS',
  'IMPORT_ROLLBACK_IN_PROGRESS',
]);

export const TERMINAL_FAILURE_DURING_WAIT = new Set([
  'UPDATE_ROLLBACK_FAILED',
  'UPDATE_FAILED',
  'CREATE_FAILED',
  'ROLLBACK_FAILED',
  'IMPORT_ROLLBACK_FAILED',
  'DELETE_FAILED',
]);

assert(DEPLOYABLE_STATUSES.size > 0);
assert(FORBIDDEN_STATUSES.size > 0);
assert(TRANSIENT_STATUSES.size > 0);
assert(TERMINAL_FAILURE_DURING_WAIT.size > 0);

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
  assert(client !== undefined && client !== null);
  try {
    const out = await client.send(
      new DescribeStacksCommand({ StackName: STACK_NAME })
    );
    const s = out.Stacks?.[0];
    if (s === undefined) {
      return null;
    }
    assert(out.Stacks !== undefined && out.Stacks.length > 0);
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
