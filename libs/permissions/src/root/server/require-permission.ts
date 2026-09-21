import type { AppAuth } from '@libs/auth/public/auth-context';
import { UnauthorizedError } from '@libs/auth/public/unauthorized-error';
import {
  decide,
  type PermissionPolicy,
  resolveSubject,
  type Subject,
} from '@pkgs/permissions';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type {
  AppLimit,
  AppPermission,
  AppPolicyKey,
} from '../../shared/permission-catalog';
import {
  readAccessFacts,
  readPermissionPolicy,
} from '../../shared/read-access';

/** Live `permission_policy` row parsed to the app policy (default when absent). */
export async function resolveServerPermissionPolicy(
  db: SqlClient
): Promise<PermissionPolicy<AppPolicyKey, AppLimit>> {
  return readPermissionPolicy(db);
}

/**
 * Subject for the request actor: facts (auth state, membership incl. grace)
 * read from the same synced rows the client reads, roles picked by the
 * policy's predicates. No auth context is an anonymous subject.
 */
export async function resolveServerPermissionSubject(args: {
  readonly db: SqlClient;
  readonly auth: AppAuth | null;
  readonly nowMs: number;
}): Promise<Subject> {
  const policy = await readPermissionPolicy(args.db);
  const facts = await readAccessFacts(
    args.db,
    {
      actorId: args.auth?.myId ?? '',
      accountId: args.auth?.accountId ?? null,
      isAnon: args.auth?.isAnon ?? true,
    },
    args.nowMs
  );
  return resolveSubject(policy, facts);
}

/**
 * Throws `UnauthorizedError` (mapped to 401 by the API error handler) when the
 * request actor lacks `permission`.
 */
export async function requirePermission(args: {
  readonly db: SqlClient;
  readonly auth: AppAuth | null;
  readonly permission: AppPermission;
  readonly nowMs: number;
}): Promise<void> {
  const [policy, subject] = await Promise.all([
    resolveServerPermissionPolicy(args.db),
    resolveServerPermissionSubject({
      db: args.db,
      auth: args.auth,
      nowMs: args.nowMs,
    }),
  ]);
  if (!decide(policy, subject, args.permission).allowed) {
    throw new UnauthorizedError(`Permission denied: ${args.permission}`);
  }
}
