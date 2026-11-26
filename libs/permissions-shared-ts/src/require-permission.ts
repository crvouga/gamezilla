import type { AppAuth } from '@libs/auth-shared-ts/auth-context';
import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import { ForbiddenError } from '@pkgs/assert-root-shared-ts/forbidden-error';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { decideForActor } from './decide-for-actor';
import { type AppPermission, PERMISSION } from './permission-catalog';

/**
 * Throws `UnauthorizedError` (mapped to 401 by the API error handler) when the
 * request actor lacks `permission`. Facts (auth state, membership incl. grace,
 * the billing switch) come from the same synced rows the client reads; no
 * auth context is an anonymous subject.
 */
type PermissionRequest = {
  readonly db: SqlClient;
  readonly auth: AppAuth | null;
  readonly permission: AppPermission;
  readonly nowMs: number;
};

function permissionDecision(args: PermissionRequest) {
  return decideForActor(args.db, {
    identity: {
      actorId: args.auth?.myId ?? '',
      accountId: args.auth?.accountId ?? null,
      isAnon: args.auth?.isAnon ?? true,
    },
    key: args.permission,
    nowMs: args.nowMs,
    clientAtMs: args.nowMs,
  });
}

export async function requirePermission(
  args: PermissionRequest
): Promise<void> {
  if (!(await permissionDecision(args)).allowed) {
    throw new UnauthorizedError(`Permission denied: ${args.permission}`);
  }
}

/** A missing or expired session may sign in; a valid account without the grant is forbidden. */
export async function requireAdminAccess(
  args: Omit<PermissionRequest, 'permission'>
): Promise<void> {
  if (!args.auth || args.auth.isAnon || !args.auth.accountId)
    throw new UnauthorizedError('Sign in to open administration.');
  if (
    !(await permissionDecision({ ...args, permission: PERMISSION.adminAccess }))
      .allowed
  )
    throw new ForbiddenError('This account does not have admin access.');
}
