#!/usr/bin/env bun
// @io-wall-ok — retire superseded code only after the live health gate.
import { envFile } from '@libs/infra-shared-ts/envs';
import {
  assertWorkersRetirable,
  ROOM_CLASS,
} from '@libs/infra-shared-ts/worker-lifecycle';
import type { RetirementResult } from '@libs/infra-shared-ts/worker-retirement';
import { retireWorker } from '@libs/infra-shared-ts/worker-retirement';
import { workerState } from './worker-state';

const env = envFile(process.env['SECRETS_ENV'] ?? '');
const state = workerState(env);
const [namespaces, domains, boundId] = await Promise.all([
  state.namespaces(),
  state.domains(),
  state.roomNamespaceId(env.worker.name),
]);
assertWorkersRetirable(env, namespaces, domains);
if (
  !namespaces.some(
    (ns) =>
      ns.script === env.worker.name &&
      ns.class === ROOM_CLASS &&
      ns.id === boundId
  )
)
  throw new Error(
    'Application ROOM binding does not point at its owned namespace'
  );

function removeWorker(name: string): RetirementResult {
  const result = Bun.spawnSync(
    ['wrangler', 'delete', '--name', name, '--force'],
    {
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: env.cloudflare.account_id,
        WRANGLER_SEND_METRICS: 'false',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

for (const name of env.worker.retire) {
  const result = await retireWorker(name, removeWorker, state);
  if (result.exitCode === 0) process.stdout.write(result.stdout);
  else console.log(`Worker ${name} is absent; retirement is complete`);
}
