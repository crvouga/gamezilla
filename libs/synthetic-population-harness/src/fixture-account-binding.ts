import type { ProductHarness } from '@libs/harness/harness';
import { HARNESS_SERVER_URL } from '@libs/sub-shared/harness-constants';
import type { Lease } from '@libs/synthetic-population-server/records';
import type { SyntheticPopulationWorkerRPC } from '@libs/synthetic-population-server/worker-routes';
import sql from '@pkgs/sql-root-shared/sql';
import { hc } from 'hono/client';

/** The ordinary authenticated account is classified by the actual worker RPC. */
export async function bindFixtureAccount(
  s: ProductHarness,
  input: { lease: Lease; deviceId: string; token: string }
): Promise<void> {
  const token = (
    await s.harness.server.secrets.getRequired('POPULATION_WORKER_TOKEN')
  ).readSecretValue();
  await s.harness.serverSql.sqlClient.run(sql`
    UPDATE population_users SET device_id = ${input.deviceId}
    WHERE id = ${input.lease.userId}
  `);
  const client = hc<SyntheticPopulationWorkerRPC>(
    `${HARNESS_SERVER_URL}/api/synthetic-population-worker`,
    {
      fetch: s.harness.loadBalancer.fetchFrom('synthetic-population-fixture'),
      headers: { authorization: `Bearer ${token}` },
    }
  );
  const response = await client['bind-account'].$post({
    json: { ...input.lease, token: input.token },
  });
  if (!response.ok)
    throw new Error(`Account binding refused (${response.status})`);
}
