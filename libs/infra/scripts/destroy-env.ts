#!/usr/bin/env bun
// @io-wall-ok — CLI entry: orchestrates one environment's teardown.
/**
 * Tears one `protection: "standard"` environment down completely — the
 * inverse of its deploy — so environments are cattle: destroy one, and the
 * next Deploy (or `SECRETS_ENV=<env> bun run deploy`) rebuilds it from its
 * env file alone.
 *
 *   bun run infra:destroy -- --env <env> --confirm <env>
 *
 * Order (each step under `secrets-run` for the right secrets environment):
 *
 *   1. edge       custom domains              tofu destroy (edge)
 *   2. Workers    api, web, room              wrangler delete
 *   3. objects    the env's bucket, emptied   scripts/empty-bucket.ts
 *   4. foundation Neki database, Hyperdrive, bucket, IoT broker,
 *                 trace tokens, secrets       tofu destroy (foundation)
 *   5. fleet      the env's secrets environment + shared import
 *                                             tofu destroy --stack fleet --env
 *
 * Every tofu step goes through `scripts/tofu.ts destroy`: plan → policy
 * (which refuses any production teardown) → state backup → apply that plan.
 * Production is refused here too, before anything runs. To retire the
 * environment for good afterwards, delete its env file (and its `envs.ts`
 * entry) in a PR.
 */
import { join } from 'node:path';
import { envFile } from '@libs/infra/public/envs';
import { GLOBAL } from '@libs/infra/public/global';
import { envResourceNames } from '@libs/infra/public/naming';
import { fail } from './tofu-process';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const PKG_DIR = join(import.meta.dirname, '..');
const SECRETS_RUN = join(REPO_ROOT, 'libs/secrets/src/scripts/secrets-run.ts');
// secrets-run starts every child at the repo root, so scripts are passed by
// absolute path.

function flag(name: string): string | null {
  const at = process.argv.indexOf(name);
  return at < 0 ? null : (process.argv[at + 1] ?? null);
}

/** Runs `cmd` with `secretsEnv`'s secrets injected; fails the teardown on error. */
function step(
  label: string,
  secretsEnv: string,
  cmd: readonly string[],
  options: {
    readonly tolerate?: (stderr: string) => boolean;
    readonly env?: Readonly<Record<string, string>>;
  } = {}
): void {
  console.log(`\n[infra:destroy] ${label}`);
  const tolerant = options.tolerate !== undefined;
  const result = Bun.spawnSync(['bun', 'run', SECRETS_RUN, '--', ...cmd], {
    cwd: PKG_DIR,
    env: { ...process.env, ...options.env, SECRETS_ENV: secretsEnv },
    stdout: 'inherit',
    stderr: tolerant ? 'pipe' : 'inherit',
  });
  const stderr = result.stderr?.toString() ?? '';
  if (tolerant) process.stderr.write(stderr);
  if (result.exitCode === 0) return;
  if (options.tolerate?.(stderr) === true) {
    console.log(`[infra:destroy] ${label}: already gone`);
    return;
  }
  fail(`${label} failed (exit ${String(result.exitCode)}) — rerun to resume`);
}

const name = flag('--env');
if (name === null) fail('usage: infra:destroy -- --env <env> --confirm <env>');
const env = envFile(name);
if (env.protection !== 'standard') {
  fail(`${env.env} has protection "${env.protection}": it is never torn down`);
}
if (flag('--confirm') !== env.env) {
  fail(`pass --confirm ${env.env} to tear down ${env.env} and all its data`);
}

const tofuDestroy = (stack: string, extra: readonly string[] = []) => [
  'bun',
  'run',
  join(PKG_DIR, 'scripts/tofu.ts'),
  'destroy',
  '--stack',
  stack,
  ...extra,
];
const names = envResourceNames(env);
const missingWorker = (stderr: string): boolean =>
  /does not exist|not found|10007/i.test(stderr);

step('edge: custom domains', env.env, tofuDestroy('edge'));
for (const worker of [names.api_worker, names.web_worker, names.room_worker]) {
  step(
    `Worker ${worker}`,
    env.env,
    ['bunx', 'wrangler', 'delete', '--name', worker, '--force'],
    {
      tolerate: missingWorker,
      env: {
        CLOUDFLARE_ACCOUNT_ID: env.cloudflare.account_id,
        WRANGLER_SEND_METRICS: 'false',
      },
    }
  );
}
step(`objects in ${names.bucket}`, env.env, [
  'bun',
  'run',
  join(PKG_DIR, 'scripts/empty-bucket.ts'),
]);
step('foundation', env.env, tofuDestroy('foundation'));
step(
  'fleet: secrets environment',
  GLOBAL.infisical.shared_env,
  tofuDestroy('fleet', ['--env', env.env])
);

console.log(
  `\n[infra:destroy] ${env.env} is gone. Rebuild it: \`bun run infra:fleet && SECRETS_ENV=${env.env} bun run deploy\` (or the Deploy workflow). Retire it: delete libs/infra/tofu/envs/${env.env}.tfvars.json and its envs.ts entry.`
);
