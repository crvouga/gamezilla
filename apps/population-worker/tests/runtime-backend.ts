import { workerWallPorts } from '@apps/population-worker/wall-io';
import { createWorkerRpc } from '@apps/population-worker/worker-rpc';
import { createHarness } from '@libs/harness/create-harness';
import { PopulationAdministration } from '@libs/population-server/population-administration';
import { PopulationRepository } from '@libs/population-server/population-repository';
import { APP_COMPOSITION } from '@libs/runtime-harness/app-composition';
import { realTimeRuntime } from '@pkgs/harness-root-shared/real-time-runtime';

export async function runtimeBackend(desired: number) {
  let elapsedMs = 0;
  const session = await realTimeRuntime({ network: 'model' })
    .with((source) => ({
      clock: { now: () => source.ports.clock.now() + elapsedMs },
    }))
    .open(7221);
  const wall = workerWallPorts();
  const token = `${wall.createId()}-${wall.createId()}`;
  const harness = await createHarness(session, {
    composition: APP_COMPOSITION,
    secretValues: {
      POPULATION_WORKER_TOKEN: token,
      POPULATION_CREDENTIAL_SECRET: `${wall.createId()}-${wall.createId()}`,
    },
  });
  await harness.spawnServer();
  const ports = { ...session.ports, notify: async () => undefined };
  const repository = new PopulationRepository(
    harness.serverSql.sqlClient,
    ports
  );
  const config = await repository.config();
  const administration = new PopulationAdministration(
    harness.serverSql.sqlClient,
    ports
  );
  await administration.configure(
    {
      ...config,
      desired,
      capacityPerWorker: Math.max(1, desired),
      actionIntervalMs: 500,
    },
    wall.createId()
  );
  const requests: { path: string; status: number | null }[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: async (request) => {
      const entry = {
        path: new URL(request.url).pathname,
        status: null as number | null,
      };
      requests.push(entry);
      const response =
        await harness.loadBalancer.fetchFrom('population-worker')(request);
      entry.status = response.status;
      return response;
    },
  });
  const rpc = createWorkerRpc(server.url.origin, token, wall.http);
  return {
    origin: server.url.origin,
    rpc,
    workerToken: token,
    wall,
    repository,
    administration,
    requests,
    advanceServerTime(ms: number) {
      elapsedMs += ms;
    },
    async close() {
      await server.stop(true);
      await harness.dispose();
      await session.dispose();
    },
  };
}
