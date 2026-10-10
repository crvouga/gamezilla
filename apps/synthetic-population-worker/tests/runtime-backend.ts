import { workerWallPorts } from '@apps/synthetic-population-worker/wall-io';
import { createWorkerRpc } from '@apps/synthetic-population-worker/worker-rpc';
import { createHarness } from '@libs/harness/create-harness';
import { APP_COMPOSITION } from '@libs/runtime-harness/app-composition';
import { SyntheticPopulationAdministration } from '@libs/synthetic-population-server/synthetic-population-administration';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server/synthetic-population-repository';
import { realTimeRuntime } from '@pkgs/harness-root-shared/real-time-runtime';
import sql from '@pkgs/sql-root-shared/sql';
import { lostMoveAcknowledgement } from './lost-acknowledgement';

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
  const repository = new SyntheticPopulationRepository(
    harness.serverSql.sqlClient,
    ports
  );
  const config = await repository.config();
  const administration = new SyntheticPopulationAdministration(
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
  const acknowledgement = lostMoveAcknowledgement();
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: async (request) => {
      const move = await acknowledgement.observe(request);
      const entry = {
        path: new URL(request.url).pathname,
        status: null as number | null,
      };
      requests.push(entry);
      const response = await harness.loadBalancer.fetchFrom(
        'synthetic-population-worker'
      )(request);
      entry.status = response.status;
      return acknowledgement.disrupt(move, response);
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
    acknowledgement,
    async moveEffects(requestId: string) {
      return harness.serverSql.sqlClient.query(
        sql<{
          count: number;
        }>`SELECT COUNT(*) AS count FROM chess_multiplayer_commands WHERE request_id = ${requestId} AND deleted_at IS NULL`
      );
    },
    advanceServerTime(ms: number) {
      elapsedMs += ms;
    },
    async replaceStoredCheckpoint(userId: string, value: unknown) {
      await harness.serverSql.sqlClient.run(
        sql`UPDATE population_users SET checkpoint = ${JSON.stringify(value)} WHERE id = ${userId}`
      );
    },
    async close() {
      await server.stop(true);
      await harness.dispose();
      await session.dispose();
    },
  };
}
