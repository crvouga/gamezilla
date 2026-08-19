/**
 * CI Turbo check graphs (secrets-run wrappers in package.json).
 *
 * Modes:
 * - `all` — offline graph (same task set as root `bun check`; kept for callers)
 * - `ci` — turbo-only lanes including secrets validate (no static/api/browser)
 * - `gates` / `verify` / `build` — GHA job subsets
 *
 * Builds use package-scoped entrypoints (`@apps/api#build` etc.) so
 * `@apps/client` still gets `tc`/`test` without Expo `build`, in one
 * `turbo run` (no second filtered pass).
 * Live-server checks (`check:api`) stay opt-in / CI-only.
 * Secrets validation stays CI / opt-in (`check:ci:gates`, `check:secrets`).
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
  'ci:local-dev-self-contained',
  'ci:no-local-tables',
  'ci:no-raw-schema-sql',
  'ci:domain-table-prefixes',
  'ci:dst-selector-discipline',
  'ci:no-legacy-writes',
  'ci:no-domain-hard-delete',
  'ci:no-top-level-di-functions',
  'ci:no-eager-di-construction',
  'ci:layer-c-sql-tx',
  'ci:no-di-container',
  'ci:fanout-rows-from-reads',
  'ci:mutation-determinism',
  'ci:channel-exhaustiveness',
  'ci:sync-engine-terminology',
  'ci:sync-engine-blackbox-tests',
  'ci:matchmaking-blackbox-tests',
  'ci:sync-engine-framework-leak',
  'ci:sync-engine-protocol-freeze',
  'ci:sync-engine-public-api',
  'ci:no-provider-leaks',
  'ci:api-isomorphic',
  'ci:no-bare-io',
  'ci:no-bare-fs',
  'ci:no-resolve-wall-defaults',
  'ci:no-sql-wall-io',
  'ci:no-vendor-sql',
  'ci:hard-determinism',
  'ci:sim-determinism',
  'ci:pubsub-emqx-imports',
  'ci:depcruise',
  'ci:circular-deps',
  'ci:tier-imports',
  'ci:use-case-isolation',
  'ci:libs-import-surface',
  'ci:component-ids',
  'ci:no-rn-style-api',
  'ci:no-size-limit-overrides',
  'ci:audit',
] as const;

/** No-op app builds only — never `@apps/client#build` (Expo export). */
const CHECK_BUILD_TASKS = ['@apps/api#build'] as const;

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
      return [
        'tc',
        'test',
        'ci:lint',
        ...CI_GATE_TASKS,
        'check:static',
        ...CHECK_BUILD_TASKS,
      ];
    case 'ci':
      return [
        'tc',
        'test',
        'ci:lint',
        ...CI_GATE_TASKS,
        SECRETS_VALIDATE_TASK,
        ...CHECK_BUILD_TASKS,
      ];
    case 'gates':
      return [...CI_GATE_TASKS, SECRETS_VALIDATE_TASK];
    case 'verify':
      return ['tc', 'test', 'ci:lint'];
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
  process.env['TURBO_CONCURRENCY'] = '32';
}
await ensureSecretsFingerprint(main);
process.exit(turboCiRun(main));
