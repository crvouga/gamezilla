import type { ProductHarness } from '@libs/harness-ts/harness';
import type { Lease } from '@libs/synthetic-population-server-ts/records';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { fixtureWorkerRpc } from './fixture-worker-rpc';

/** The ordinary authenticated account is classified by the actual worker RPC. */
export async function bindFixtureAccount(
  s: ProductHarness,
  input: { lease: Lease; deviceId: string; token: string }
): Promise<void> {
  await s.harness.serverSql.sqlClient.run(sql`
    UPDATE population_users SET device_id = ${input.deviceId}
    WHERE id = ${input.lease.userId}
  `);
  const client = await fixtureWorkerRpc(s);
  const response = await client['bind-account'].$post({
    json: { ...input.lease, token: input.token },
  });
  if (!response.ok)
    throw new Error(`Account binding refused (${response.status})`);
}
