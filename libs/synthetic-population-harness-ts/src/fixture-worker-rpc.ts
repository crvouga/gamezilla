import type { ProductHarness } from '@libs/harness-ts/harness';
import { HARNESS_SERVER_URL } from '@libs/sub-shared-ts/harness-constants';
import type { SyntheticPopulationWorkerRPC } from '@libs/synthetic-population-server-ts/worker-routes';
import { hc } from 'hono/client';

/** The worker control plane, reached and authenticated as a real worker's. */
export async function fixtureWorkerRpc(s: ProductHarness) {
  const token = (
    await s.harness.server.secrets.getRequired('POPULATION_WORKER_TOKEN')
  ).readSecretValue();
  return hc<SyntheticPopulationWorkerRPC>(
    `${HARNESS_SERVER_URL}/api/synthetic-population-worker`,
    {
      fetch: s.harness.loadBalancer.fetchFrom('synthetic-population-fixture'),
      headers: { authorization: `Bearer ${token}` },
    }
  );
}
