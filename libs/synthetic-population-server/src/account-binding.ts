import { BearerAuthResolver } from '@libs/auth-shared/bearer-resolve';
import type { AuthServerPort } from '@pkgs/auth-root-shared/auth-server-port';
import type { SqlClient, SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { Lease, SyntheticPopulationPorts } from './records';
import { isoAt } from './records';

async function classifyAccount(
  tx: SqlTx,
  accountId: string,
  now: string
): Promise<void> {
  await tx.run(sql`INSERT INTO profile (id, created_at, updated_at, account_kind)
    VALUES (${accountId}, ${now}, ${now}, ${'synthetic'})
    ON CONFLICT (id) DO UPDATE SET account_kind = ${'synthetic'}, updated_at = ${now}
    WHERE profile.deleted_at IS NULL`);
}

/** Bind only the normally authenticated account whose address was provisioned. */
export async function bindSyntheticPopulationAccount(
  deps: {
    db: SqlClient;
    authServer: AuthServerPort;
    ports: SyntheticPopulationPorts;
    notifyProfile: (accountId: string) => Promise<void>;
  },
  lease: Omit<Lease, 'expiresAt'>,
  token: string
): Promise<boolean> {
  const verified = await deps.authServer.verifySessionToken(token);
  if (verified === null) return false;
  const now = isoAt(deps.ports.clock.now());
  const rows = await deps.db.query(
    sql<{
      email: string;
      device_id: string;
    }>`SELECT email, device_id FROM population_users WHERE id = ${lease.userId} AND worker_id = ${lease.workerId} AND generation = ${lease.generation} AND lease_until > ${now} AND deleted_at IS NULL`
  );
  const row = rows[0];
  if (row === undefined || verified.email !== row.email) return false;
  const accountId = await new BearerAuthResolver(
    deps.db,
    deps.authServer,
    deps.ports
  ).resolveAccountId(token, row.device_id);
  if (accountId === null) return false;
  const bound = await deps.db.transaction(async (tx) => {
    const rows = await tx.query(
      sql<{
        id: string;
      }>`UPDATE population_users SET account_id = ${accountId}, updated_at = ${isoAt(deps.ports.clock.now())} WHERE id = ${lease.userId} AND worker_id = ${lease.workerId} AND generation = ${lease.generation} AND lease_until > ${isoAt(deps.ports.clock.now())} AND (account_id IS NULL OR account_id = ${accountId}) AND deleted_at IS NULL RETURNING id`
    );
    if (rows.length === 0) return false;
    // The ownership CAS locks the assignment until both writes commit.
    await classifyAccount(tx, accountId, isoAt(deps.ports.clock.now()));
    return true;
  });
  if (bound) {
    await deps.notifyProfile(accountId);
    await deps.ports.notify();
  }
  return bound;
}
