// @io-wall-ok — Population Worker process composition root.
import { workerWallPorts } from './wall-io';

const wall = workerWallPorts();

import { createLogger } from '@pkgs/logger-shared/logger';
import { processLifecycle } from '@pkgs/os-server/process-lifecycle';
import { createIsolatedWorker } from '@pkgs/os-server/wall-isolated-worker';
import { Hono } from 'hono';
import { readWorkerEnvironment } from './config';
import { PopulationWorker } from './population-worker';
import { createWorkerRpc } from './worker-rpc';

const processPort = processLifecycle();
const env = readWorkerEnvironment(processPort.env);
const log = createLogger({ name: 'population-worker', now: wall.clock.now });
const worker = new PopulationWorker(
  {
    id: wall.createId(),
    origin: env.POPULATION_API_ORIGIN,
    version: env.DEPLOYMENT_VERSION,
    capacity: env.POPULATION_CAPACITY,
    shutdownMs: env.POPULATION_SHUTDOWN_MS,
  },
  {
    clock: wall.clock,
    timers: wall.timers,
    log,
    resources: processPort.resources,
    rpc: createWorkerRpc(
      env.POPULATION_API_ORIGIN,
      env.POPULATION_WORKER_TOKEN,
      wall.http
    ),
    spawn: () =>
      createIsolatedWorker(new URL('./session-entry.ts', import.meta.url), [
        '@pkgs/bun-test-solid-client/register',
      ]),
  }
);
const health = new Hono()
  .get('/health', (c) => c.json({ healthy: true }))
  .get('/ready', (c) =>
    c.json({ ready: worker.status().ready }, worker.status().ready ? 200 : 503)
  );
const server = Bun.serve({ port: env.PORT, fetch: health.fetch });
let terminating = false;
processPort.onTermination(() => {
  if (terminating) return;
  terminating = true;
  void worker.drain().then(
    () => {
      server.stop(true);
      processPort.exit(0);
    },
    () => {
      server.stop(true);
      processPort.exit(1);
    }
  );
});
await worker.start();
log.info('Population Worker started', {
  workerId: worker.status().workerId,
  version: env.DEPLOYMENT_VERSION,
  capacity: env.POPULATION_CAPACITY,
});
