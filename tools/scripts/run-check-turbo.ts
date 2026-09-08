/**
 * CI Turbo check graphs (secrets-run wrappers in package.json).
 *
 * Prefer root `bun check` (fast: lint/tc/test) and `bun check:full` (CD gate
 * leaves) — those expand via turbo-ci-run from `//#check` / `//#check:full`.
 *
 * Modes (legacy / subset callers):
 * - `all` — same leaf set as flattened `check:full` without live secrets
 *   fingerprint (static still included; secrets via separate mode)
 * - `ci` — turbo-only lanes including secrets validate (no static/api)
 * - `gates` / `verify` / `build` — GHA job subsets
 * - `verify` — same as fast `bun check` leaves (lint/tc/test)
 *
 * Builds use package-scoped entrypoints (`@apps/server#build` etc.) so
 * `@apps/client` still gets `tc`/`test` without the web `build`, in one
 * `turbo run` (no second filtered pass).
 * Live-server checks (`check:api`) stay on `check:full` / deploy.
 */
import { spawnSync } from 'node:child_process';

import {
  CHECK_SECRETS_FINGERPRINT_ENV,
  computeCheckSecretsFingerprint,
} from '../../libs/secrets/src/shared/secrets/check-secrets-fingerprint';

const CI_GATE_TASKS = [
  'ci:syncpack',
  'ci:depcruise',
  'ci:audit',
  'ci:i18n',
] as const;

/** No-op app builds only — never `@apps/client#build` (web export). */
const CHECK_BUILD_TASKS = [
  '@apps/server#build',
  '@apps/room-server#build',
] as const;

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

function mainTasks(mode: Mode): readonly string[] {
  switch (mode) {
    case 'all':
      return ['check:full'];
    case 'ci':
      return [
        'lint',
        'tc',
        'test',
        ...CI_GATE_TASKS,
        SECRETS_VALIDATE_TASK,
        ...CHECK_BUILD_TASKS,
      ];
    case 'gates':
      return [...CI_GATE_TASKS, SECRETS_VALIDATE_TASK];
    case 'verify':
      return ['check'];
    case 'build':
      return [...CHECK_BUILD_TASKS];
  }
}

async function ensureSecretsFingerprint(
  tasks: readonly string[]
): Promise<void> {
  if (!tasks.includes(SECRETS_VALIDATE_TASK)) return;
  // Infisical `export` for dev+prd has no CLI timeout; without a log line
  // CI gates look hung before Turbo starts.
  console.log('run-check-turbo: computing secrets fingerprint (Infisical)…');
  const fingerprint = await computeCheckSecretsFingerprint();
  process.env[CHECK_SECRETS_FINGERPRINT_ENV] = fingerprint;
  console.log('run-check-turbo: secrets fingerprint ready.');
}

const mode = parseMode(process.argv.slice(2));
const main = mainTasks(mode);
if (
  mode === 'gates' &&
  (process.env['TURBO_CONCURRENCY']?.trim() ?? '') === ''
) {
  process.env['TURBO_CONCURRENCY'] = '8';
}
await ensureSecretsFingerprint(main);
process.exit(turboCiRun(main));
