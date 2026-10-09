import { BearerAuthResolver } from '@libs/auth-shared/bearer-resolve';
import type { AuthServerPort } from '@pkgs/auth-root-shared/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { Lease, PopulationPorts } from './records';
import { isoAt } from './records';

/** Bind only the normally authenticated account whose address was provisioned. */
export async function bindPopulationAccount(
  deps: { db: SqlClient; authServer: AuthServerPort; ports: PopulationPorts },
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
  const bound = await deps.db.query(
    sql<{
      id: string;
    }>`UPDATE population_users SET account_id = ${accountId}, updated_at = ${isoAt(deps.ports.clock.now())} WHERE id = ${lease.userId} AND worker_id = ${lease.workerId} AND generation = ${lease.generation} AND lease_until > ${isoAt(deps.ports.clock.now())} AND (account_id IS NULL OR account_id = ${accountId}) AND deleted_at IS NULL RETURNING id`
  );
  if (bound.length > 0) await deps.ports.notify();
  return bound.length > 0;
}
