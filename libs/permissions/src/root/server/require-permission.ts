import type { AppAuth } from '@libs/auth/public/auth-context';
import { UnauthorizedError } from '@libs/auth/public/unauthorized-error';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { decideForActor } from '../../shared/decide-for-actor';
import type { AppPermission } from '../../shared/permission-catalog';

/**
 * Throws `UnauthorizedError` (mapped to 401 by the API error handler) when the
 * request actor lacks `permission`. Facts (auth state, membership incl. grace,
 * the billing switch) come from the same synced rows the client reads; no
 * auth context is an anonymous subject.
 */
export async function requirePermission(args: {
  readonly db: SqlClient;
  readonly auth: AppAuth | null;
  readonly permission: AppPermission;
  readonly nowMs: number;
}): Promise<void> {
  const decision = await decideForActor(args.db, {
    identity: {
      actorId: args.auth?.myId ?? '',
      accountId: args.auth?.accountId ?? null,
      isAnon: args.auth?.isAnon ?? true,
    },
    key: args.permission,
    nowMs: args.nowMs,
    clientAtMs: args.nowMs,
  });
  if (!decision.allowed) {
    throw new UnauthorizedError(`Permission denied: ${args.permission}`);
  }
}
