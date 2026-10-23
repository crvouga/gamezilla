// @io-wall-ok — Synthetic Population Worker process composition root.
import { workerWallPorts } from './wall-io';

const wall = workerWallPorts();

import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { processLifecycle } from '@pkgs/os-server-ts/process-lifecycle';
import { createIsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import { Hono } from 'hono';
import { readWorkerEnvironment } from './config';
import { shutdownSyntheticPopulationWorker } from './shutdown';
import { SyntheticPopulationWorker } from './synthetic-population-worker';
import { syntheticPopulationMetrics } from './wall-metrics';
import {
  observedSyntheticPopulationHttp,
  syntheticPopulationTelemetry,
} from './wall-telemetry';
import { createWorkerRpc } from './worker-rpc';

const processPort = processLifecycle();
const env = readWorkerEnvironment(processPort.env);
const telemetry = syntheticPopulationTelemetry(processPort.env);
const log = createLogger({
  name: 'synthetic-population-worker',
  now: wall.clock.now,
});
const worker: SyntheticPopulationWorker = new SyntheticPopulationWorker(
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
      observedSyntheticPopulationHttp(wall.http)
    ),
    spawn: () =>
      metrics.realm(
        createIsolatedWorker(new URL('./session-entry.ts', import.meta.url), [
          '@pkgs/bun-test-solid-client-ts/register',
        ])
      ),
  }
);
const metrics = syntheticPopulationMetrics(processPort.env, {
  clock: wall.clock,
  instanceId: worker.status().workerId,
  current: () => ({
    worker: worker.status(),
    resources: processPort.resources(),
  }),
});
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
  void shutdownSyntheticPopulationWorker(
    () => worker.drain(),
    async () => {
      const flushed = await Promise.allSettled([
        telemetry.shutdown(),
        metrics.shutdown(),
      ]);
      if (flushed.some((result) => result.status === 'rejected'))
        throw new Error(
          'Synthetic Population Worker telemetry could not be flushed'
        );
    },
    (code) => {
      server.stop(true);
      processPort.exit(code);
    }
  );
});
await worker.start();
log.info('Synthetic Population Worker started', {
  workerId: worker.status().workerId,
  version: env.DEPLOYMENT_VERSION,
  capacity: env.POPULATION_CAPACITY,
});
