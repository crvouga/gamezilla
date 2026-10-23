import { workerWallPorts } from '@apps/synthetic-population-worker-ts/wall-io';
import { createWorkerRpc } from '@apps/synthetic-population-worker-ts/worker-rpc';
import { createHarness } from '@libs/harness-ts/create-harness';
import { APP_COMPOSITION } from '@libs/runtime-harness-ts/app-composition';
import { SyntheticPopulationAdministration } from '@libs/synthetic-population-server-ts/synthetic-population-administration';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server-ts/synthetic-population-repository';
import { realTimeRuntime } from '@pkgs/harness-root-shared-ts/real-time-runtime';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { lostMoveAcknowledgement } from './lost-acknowledgement';
import { runtimePubSub } from './runtime-pubsub';

export async function runtimeBackend(desired: number) {
  const cleanup = new AsyncDisposableStack();
  try {
    return await openRuntimeBackend(desired, cleanup);
  } catch (error) {
    await cleanup.disposeAsync();
    throw error;
  }
}

async function openRuntimeBackend(
  desired: number,
  cleanup: AsyncDisposableStack
) {
  let elapsedMs = 0;
  const session = await realTimeRuntime({ network: 'model' })
    .with((source) => ({
      clock: { now: () => source.ports.clock.now() + elapsedMs },
    }))
    .open(7221);
  cleanup.defer(() => session.dispose());
  const wall = workerWallPorts();
  const token = `${wall.createId()}-${wall.createId()}`;
  // As deployed, a Synthetic User's application runs on an origin the API
  // trusts: sign-in links are only ever minted for a trusted callback.
  let serve: (request: Request) => Promise<Response> = async () =>
    new Response('The backend is starting', { status: 503 });
  const services = new AsyncDisposableStack();
  cleanup.defer(() => services.disposeAsync());
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: (request) => serve(request),
  });
  // Drain admitted HTTP work while its harness and broker are still alive.
  cleanup.defer(() => server.stop());
  const messaging = await runtimePubSub(wall);
  services.defer(() => messaging.close());
  const harness = await createHarness(session, {
    composition: APP_COMPOSITION,
    serverEvents: messaging.events,
    secretValues: {
      POPULATION_WORKER_TOKEN: token,
      WEB_CLIENT_ORIGIN: server.url.origin,
      EMQX_WSS_URL: messaging.url,
      EMQX_JWT_SECRET: wall.createId(),
    },
  });
  services.defer(() => harness.dispose());
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
  serve = async (request) => {
    const entry = {
      path: new URL(request.url).pathname,
      status: null as number | null,
    };
    requests.push(entry);
    const move = await acknowledgement.observe(request);
    const response = await harness.loadBalancer.fetchFrom(
      'synthetic-population-worker'
    )(request);
    entry.status = response.status;
    return acknowledgement.disrupt(move, response);
  };
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
    async acceptedGameMoves() {
      return harness.serverSql.sqlClient.query(sql<{
        owner_id: string;
        game_id: string;
      }>`
        SELECT owner_id, game_id FROM chess_multiplayer_commands
        WHERE kind = ${'move'} AND deleted_at IS NULL`);
    },
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
    close: () => cleanup.disposeAsync(),
  };
}
