#!/usr/bin/env bun
// @io-wall-ok — retire superseded code only after the live health gate.
import { envFile } from '@libs/infra/public/envs';
import {
  assertWorkersRetirable,
  ROOM_CLASS,
} from '@libs/infra/public/worker-lifecycle';
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

for (const name of env.worker.retire) {
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
  if (result.exitCode === 0) {
    process.stdout.write(result.stdout);
    continue;
  }
  const stderr = result.stderr.toString();
  if (/\[code: 10007\]/.test(stderr)) continue;
  process.stderr.write(stderr);
  throw new Error(`Retirement of ${name} failed; rerun deploy to resume`);
}
