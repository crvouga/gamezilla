import type { workerWallPorts } from '@apps/synthetic-population-worker/wall-io';
import { createHttpPubSubFromSecretStore } from '@libs/pubsub-server/create-http-pubsub-from-secret-store';
import { startAedesServer } from '@pkgs/aedes-server/start';

/** Isolated realms and the API share the real MQTT wire, as deployed. */
export async function runtimePubSub(wall: ReturnType<typeof workerWallPorts>) {
  const broker = await startAedesServer();
  const events = createHttpPubSubFromSecretStore(
    {
      apiBaseUrl: broker.wsOrigin.replace('ws:', 'http:'),
      apiKey: 'fixture',
      apiSecret: 'fixture',
    },
    { fetch: wall.http }
  );
  return {
    url: broker.wsUrl,
    events,
    async close() {
      events.close();
      await broker.stop();
    },
  };
}
