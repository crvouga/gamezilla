import { UnauthorizedError } from '@libs/auth-shared/unauthorized-error';
import type {
  RoomGrantsCtx,
  SessionAdmissionCtx,
} from '@libs/feature-shared/server';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import {
  type MutationAuthorizeCtx,
  MutationError,
} from '@pkgs/sync-engine-shared/mutations-types';
import { isoAt } from './records';

type OwnershipRow = {
  id: string;
  device_id: string | null;
  worker_id: string | null;
  lease_until: string | null;
};
async function ownership(
  db: SqlTx,
  accountId: string | null
): Promise<OwnershipRow | null> {
  if (accountId === null) return null;
  const rows = await db.query(
    sql<OwnershipRow>`SELECT id, device_id, worker_id, lease_until FROM population_users WHERE account_id = ${accountId} AND deleted_at IS NULL`
  );
  return rows[0] ?? null;
}
function admitted(row: OwnershipRow, deviceId: string, nowMs: number): boolean {
  return (
    row.device_id === deviceId &&
    row.worker_id !== null &&
    Date.parse(row.lease_until ?? '') > nowMs
  );
}
export async function authorizePopulationSession(
  ctx: SessionAdmissionCtx
): Promise<void> {
  const row = await ownership(ctx.db, ctx.accountId);
  if (row !== null && !admitted(row, ctx.deviceId, ctx.nowMs))
    throw new UnauthorizedError('Session ownership expired');
}
export async function authorizePopulationMutation(
  ctx: MutationAuthorizeCtx
): Promise<void> {
  if (ctx.env.accountId === null) return;
  // Serialize replay with lease acquisition. The transaction keeps this row lock
  // through the domain write; a replacement owner cannot overtake accepted work.
  await ctx.tx.run(
    sql`UPDATE population_users SET updated_at = updated_at WHERE account_id = ${ctx.env.accountId} AND deleted_at IS NULL`
  );
  const row = await ownership(ctx.tx, ctx.env.accountId);
  if (
    row !== null &&
    !admitted(row, ctx.env.deviceId, ctx.serverNow().getTime())
  )
    throw new MutationError(
      'SESSION_OWNERSHIP_EXPIRED',
      'Session ownership expired'
    );
}
export async function populationRoomGrants(
  ctx: RoomGrantsCtx
): Promise<readonly string[]> {
  const row = await ownership(ctx.db, ctx.actor.accountId);
  if (row === null) return [];
  if (!admitted(row, ctx.actor.deviceId, ctx.nowMs))
    throw new UnauthorizedError('Session ownership expired');
  return [`session-until:${Date.parse(row.lease_until ?? isoAt(0))}`];
}
