// @io-wall-ok — local-only Synthetic Population capacity measurement entrypoint.

import { fileURLToPath } from 'node:url';
import { disposeDomWindow } from '@pkgs/bun-test-solid-client/register';
import { processLifecycle } from '@pkgs/os-server/process-lifecycle';
import { startProcess } from '@pkgs/os-server/streaming-process';
import { runtimeBackend } from './runtime-backend';
import { awaitRuntimeUsers } from './runtime-session';

const backend = await runtimeBackend(0);
const processPort = processLifecycle();
const config = await backend.repository.config();
await backend.administration.configure(
  { ...config, capacityPerWorker: 4 },
  backend.wall.createId()
);
const child = startProcess({
  command: process.execPath,
  args: ['--conditions=browser', '--conditions=development', 'src/main.ts'],
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: {
    ...processPort.env,
    POPULATION_API_ORIGIN: backend.origin,
    POPULATION_WORKER_TOKEN: backend.workerToken,
    POPULATION_CAPACITY: '4',
    POPULATION_SHUTDOWN_MS: '1000',
    SECRETS_ENV: 'local',
    DEPLOYMENT_VERSION: 'capacity-measurement',
    PORT: '0',
  },
});
const errors: string[] = [];
child.stdout.resume();
child.stderr.on('data', (chunk: Buffer) => {
  errors.push(chunk.toString());
  if (errors.length > 8) errors.shift();
});
const sleep = (ms: number) =>
  new Promise<void>((resolve) => backend.wall.timers.setTimeout(resolve, ms));
async function heartbeat() {
  const deadline = backend.wall.clock.now() + 15_000;
  while (backend.wall.clock.now() < deadline) {
    const worker = (await backend.repository.workers())[0];
    if (worker !== undefined) return worker;
    await sleep(10);
  }
  throw new Error(
    `Population Worker did not report resource use: ${errors.join('')}`
  );
}
try {
  const baseline = await heartbeat();
  const stages = [];
  for (const desired of [1, 2, 4]) {
    const current = await backend.repository.config();
    const startedAt = backend.wall.clock.now();
    await backend.administration.configure(
      { ...current, desired },
      backend.wall.createId()
    );
    await awaitRuntimeUsers(
      backend,
      (users) =>
        users.length === desired &&
        users.every(
          (user) => user.account_id !== null && user.checkpoint !== null
        )
    );
    const authenticationBatchMs = backend.wall.clock.now() - startedAt;
    await sleep(6000);
    const first = await heartbeat();
    await sleep(6000);
    const last = await heartbeat();
    const elapsedMs =
      Date.parse(last.heartbeat_at) - Date.parse(first.heartbeat_at);
    const users = await backend.repository.users();
    const stage = {
      concurrentSyntheticUsers: desired,
      authenticationBatchMs,
      memoryBytes: last.memory_bytes,
      incrementalMemoryBytesPerUser:
        last.memory_bytes === null || baseline.memory_bytes === null
          ? null
          : Math.ceil((last.memory_bytes - baseline.memory_bytes) / desired),
      cpuCores:
        last.cpu_milliseconds === null ||
        first.cpu_milliseconds === null ||
        elapsedMs <= 0
          ? null
          : (last.cpu_milliseconds - first.cpu_milliseconds) / elapsedMs,
      activities: (await backend.administration.overview()).groups,
      recoveringUsers: users.filter((user) => user.activity === 'recovering')
        .length,
      usersWithErrors: users.filter((user) => user.last_error !== null).length,
      failures: users
        .filter((user) => user.last_error !== null)
        .map((user) => ({
          activity: user.activity,
          route: user.checkpoint?.route ?? null,
          error: user.last_error,
        })),
    };
    stages.push(stage);
    console.log(JSON.stringify(stage));
  }
  console.log(
    JSON.stringify(
      {
        runtime: `Bun ${Bun.version}`,
        measuredAt: new Date(backend.wall.clock.now()).toISOString(),
        baselineMemoryBytes: baseline.memory_bytes,
        actionIntervalMs: 500,
        stages,
        scope:
          'Worker process only, including all isolated application realms; local backend measured separately. Development module transforms are included. This measurement is not a Railway resource guarantee.',
      },
      null,
      2
    )
  );
} finally {
  child.terminate();
  await Promise.race([child.completed, sleep(3000)]);
  child.stop();
  await child.completed;
  console.log(
    JSON.stringify({
      cleanup: 'worker-stopped',
      pendingRequests: backend.requests.filter(
        (request) => request.status === null
      ),
    })
  );
  await backend.close();
  console.log(JSON.stringify({ cleanup: 'backend-stopped' }));
  await disposeDomWindow();
  console.log(JSON.stringify({ cleanup: 'dom-stopped' }));
}
