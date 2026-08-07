/**
 * Single entry for local / CI Turbo check graphs.
 *
 * Modes:
 * - `all` — full `bun check` (tc/test/lint/gates/static/secrets/api/browser + build)
 * - `ci` — turbo-only lanes (no static/api/browser)
 * - `gates` / `verify` / `build` — GHA job subsets
 *
 * `build` is a second turbo-ci-run so `--filter=!@apps/client` does not
 * exclude the client from `tc` / `test`.
 */
import { spawnSync } from 'node:child_process';

import {
  CHECK_SECRETS_FINGERPRINT_ENV,
  computeCheckSecretsFingerprint,
} from '../../libs/infra/src/cli/secrets/check-secrets-fingerprint';

const CI_GATE_TASKS = [
  'ci:syncpack',
  'ci:no-direct-pg-imports',
  'ci:database-url-policy',
  'ci:no-local-tables',
  'ci:no-legacy-writes',
  'ci:no-domain-hard-delete',
  'ci:fanout-rows-from-reads',
  'ci:mutation-determinism',
  'ci:channel-exhaustiveness',
  'ci:sync-engine-terminology',
  'ci:no-provider-leaks',
  'ci:pubsub-emqx-imports',
  'ci:depcruise',
  'ci:circular-deps',
  'ci:tier-imports',
  'ci:component-ids',
  'ci:no-size-limit-overrides',
  'ci:audit',
] as const;

const BUILD_ARGS = ['build', '--filter=!@apps/client'] as const;
const SECRETS_VALIDATE_TASK = 'check:secrets:validate';

type Mode = 'all' | 'ci' | 'gates' | 'verify' | 'build';

function parseMode(argv: ReadonlyArray<string>): Mode {
  const mode = argv[0];
  if (
    mode === 'all' ||
    mode === 'ci' ||
    mode === 'gates' ||
    mode === 'verify' ||
    mode === 'build'
  ) {
    return mode;
  }
  console.error(
    'usage: bun run tools/scripts/run-check-turbo.ts <all|ci|gates|verify|build>'
  );
  process.exit(1);
}

function turboCiRun(args: readonly string[]): number {
  const result = spawnSync(
    'bun',
    ['run', 'tools/scripts/turbo-ci-run.ts', ...args],
    { stdio: 'inherit', env: process.env }
  );
  return result.status ?? 1;
}

function mainTasks(mode: Mode): readonly string[] | null {
  switch (mode) {
    case 'all':
      return [
        'tc',
        'test',
        'ci:lint',
        ...CI_GATE_TASKS,
        'check:static',
        SECRETS_VALIDATE_TASK,
        'check:api',
        'check:browser',
      ];
    case 'ci':
      return ['tc', 'test', 'ci:lint', ...CI_GATE_TASKS, SECRETS_VALIDATE_TASK];
    case 'gates':
      return [...CI_GATE_TASKS, SECRETS_VALIDATE_TASK];
    case 'verify':
      return ['tc', 'test', 'ci:lint'];
    case 'build':
      return null;
  }
}

async function ensureSecretsFingerprint(
  tasks: readonly string[]
): Promise<void> {
  if (!tasks.includes(SECRETS_VALIDATE_TASK)) return;
  const fingerprint = await computeCheckSecretsFingerprint();
  process.env[CHECK_SECRETS_FINGERPRINT_ENV] = fingerprint;
}

const mode = parseMode(process.argv.slice(2));
const main = mainTasks(mode);

if (main !== null) {
  await ensureSecretsFingerprint(main);
  const code = turboCiRun(main);
  if (code !== 0) process.exit(code);
}

if (mode === 'all' || mode === 'ci' || mode === 'build') {
  process.exit(turboCiRun(BUILD_ARGS));
}

process.exit(0);
