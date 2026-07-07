#!/usr/bin/env bun
/**
 * Enable slow-query monitoring on a PostgreSQL database:
 * pg_stat_statements, log_min_duration_statement, auto_explain.
 *
 * Infisical: same DATABASE_URL as the main app — `dev` or `prd`
 * (scope from repo-root `.infisical.json`, overridable via SECRETS_ENV).
 * Prod CLI arg maps to secrets env `prd`.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { which } from '@pkgs/os/command';
import { resolveSecretsScope } from '@pkgs/secrets-config/infisical-json';

const REPO_ROOT = join(import.meta.dirname, '..');

type TargetEnv = 'dev' | 'prod';

type SettingRow = {
  readonly name: string;
  readonly setting: string;
  readonly pendingRestart: boolean;
};

type MonitorState = {
  readonly logMinDurationStatement: string;
  readonly sharedPreloadLibraries: string;
  readonly autoExplainLogMinDuration: string;
  readonly pgStatStatementsInstalled: boolean;
  readonly settings: readonly SettingRow[];
};

const TARGET_LOG_MIN_DURATION = '500';
const TARGET_AUTO_EXPLAIN_MIN_DURATION = '1000';
const PRELOAD_LIBS = ['pg_stat_statements', 'auto_explain'] as const;

const SETTING_NAMES = [
  'log_min_duration_statement',
  'shared_preload_libraries',
  'auto_explain.log_min_duration',
] as const;

function log(message: string): void {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${message}`);
}

function fail(message: string): never {
  log(`ERROR: ${message}`);
  process.exit(1);
}

function usage(): never {
  console.error(
    'usage: bun run scripts/enable-pg-monitoring.ts [dev|prod] [--confirm-prod]'
  );
  process.exit(1);
}

function parseArgs(argv: readonly string[]): {
  env: TargetEnv;
  confirmProd: boolean;
} {
  let env: TargetEnv = 'dev';
  let confirmProd = false;

  for (const arg of argv) {
    if (arg === '--confirm-prod') {
      confirmProd = true;
      continue;
    }
    if (arg === 'dev' || arg === 'prod') {
      env = arg;
      continue;
    }
    usage();
  }

  if (env === 'prod' && !confirmProd) {
    fail(
      'refusing to run on prod without --confirm-prod (pass: prod --confirm-prod)'
    );
  }

  return { env, confirmProd };
}

function requireCmd(name: string): void {
  if (!which(name)) {
    fail(`${name} CLI not found on PATH`);
  }
}

function resolveSecretsEnv(env: TargetEnv): string {
  return env === 'prod' ? 'prd' : 'dev';
}

function scrubPgUrl(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgres://***:***@');
}

function fetchDatabaseUrl(env: TargetEnv): string {
  const injected = process.env['DATABASE_URL']?.trim();
  if (injected !== undefined && injected.length > 0) {
    return injected;
  }

  const secretsEnv = resolveSecretsEnv(env);
  const scope = resolveSecretsScope(REPO_ROOT, secretsEnv);
  log(
    `Fetching DATABASE_URL from Infisical (workspaceId=${scope.workspaceId}, env=${scope.env})`
  );

  const result = spawnSync(
    'infisical',
    [
      'secrets',
      'get',
      'DATABASE_URL',
      '--projectId',
      scope.workspaceId,
      '--env',
      scope.env,
      '--domain',
      scope.domain,
      '--plain',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  if (result.error !== undefined) {
    fail(`infisical spawn failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = scrubPgUrl((result.stderr ?? '').trim());
    fail(
      detail.length > 0
        ? `Infisical fetch failed: ${detail}`
        : 'Infisical fetch failed — check authentication (`infisical login`) and project scope'
    );
  }

  const url = (result.stdout ?? '').trim();
  if (url.length === 0) {
    fail('Infisical returned an empty DATABASE_URL');
  }

  return url;
}

function psqlSpawn(
  databaseUrl: string,
  args: readonly string[],
  input?: string
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync('psql', [databaseUrl, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    input,
  });

  if (result.error !== undefined) {
    fail(`psql spawn failed: ${result.error.message}`);
  }

  return {
    stdout: (result.stdout ?? '').toString(),
    stderr: (result.stderr ?? '').toString(),
    status: result.status,
  };
}

function psqlQuery(databaseUrl: string, sql: string): string {
  const result = psqlSpawn(databaseUrl, [
    '-v',
    'ON_ERROR_STOP=1',
    '-tA',
    '-c',
    sql,
  ]);

  if (result.status !== 0) {
    const detail = scrubPgUrl(result.stderr.trim() || result.stdout.trim());
    fail(
      detail.length > 0
        ? `Database query failed: ${detail}`
        : 'Database query failed'
    );
  }

  return result.stdout.trim();
}

function psqlExec(databaseUrl: string, sql: string): void {
  log('Applying monitoring configuration');
  const result = psqlSpawn(databaseUrl, ['-v', 'ON_ERROR_STOP=1'], sql);

  if (result.status !== 0) {
    const detail = scrubPgUrl(result.stderr.trim() || result.stdout.trim());
    fail(
      detail.length > 0
        ? `Failed to apply configuration: ${detail}`
        : 'Failed to apply configuration'
    );
  }
}

function verifyConnectivity(databaseUrl: string): void {
  log('Checking database connectivity');
  psqlQuery(databaseUrl, 'SELECT 1');
}

function appendPreloadLib(current: string, lib: string): string {
  const trimmed = current.trim();
  const wrapped = `,${trimmed},`;
  if (wrapped.includes(`,${lib},`)) {
    return trimmed;
  }
  if (trimmed.length === 0) {
    return lib;
  }
  return `${trimmed},${lib}`;
}

function mergePreloadLibraries(current: string): {
  merged: string;
  changed: boolean;
} {
  let merged = current.trim();
  for (const lib of PRELOAD_LIBS) {
    merged = appendPreloadLib(merged, lib);
  }
  return { merged, changed: merged !== current.trim() };
}

function querySetting(databaseUrl: string, name: string): string {
  const escaped = name.replace(/'/g, "''");
  return psqlQuery(
    databaseUrl,
    `SELECT setting FROM pg_settings WHERE name = '${escaped}'`
  );
}

function queryExtensionInstalled(databaseUrl: string): boolean {
  const raw = psqlQuery(
    databaseUrl,
    "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements')"
  );
  return raw === 't' || raw === 'true' || raw === '1';
}

function querySettingsWithPending(databaseUrl: string): SettingRow[] {
  const raw = psqlQuery(
    databaseUrl,
    `SELECT name, setting, pending_restart
     FROM pg_settings
     WHERE name IN (${SETTING_NAMES.map((n) => `'${n}'`).join(', ')})
     ORDER BY name`
  );

  if (raw.length === 0) {
    return [];
  }

  return raw.split('\n').map((line) => {
    const [name, setting, pendingRestart] = line.split('|');
    return {
      name: name ?? '',
      setting: setting ?? '',
      pendingRestart: pendingRestart === 't',
    };
  });
}

function captureState(databaseUrl: string): MonitorState {
  const settings = querySettingsWithPending(databaseUrl);
  const byName = new Map(settings.map((row) => [row.name, row]));

  return {
    logMinDurationStatement:
      byName.get('log_min_duration_statement')?.setting ??
      querySetting(databaseUrl, 'log_min_duration_statement'),
    sharedPreloadLibraries:
      byName.get('shared_preload_libraries')?.setting ??
      querySetting(databaseUrl, 'shared_preload_libraries'),
    autoExplainLogMinDuration:
      byName.get('auto_explain.log_min_duration')?.setting ??
      querySetting(databaseUrl, 'auto_explain.log_min_duration'),
    pgStatStatementsInstalled: queryExtensionInstalled(databaseUrl),
    settings,
  };
}

function logCapturedState(label: string, state: MonitorState): void {
  log(`${label} log_min_duration_statement=${state.logMinDurationStatement}`);
  log(`${label} shared_preload_libraries=${state.sharedPreloadLibraries}`);
  log(
    `${label} auto_explain.log_min_duration=${state.autoExplainLogMinDuration}`
  );
  log(
    `${label} pg_stat_statements extension=${state.pgStatStatementsInstalled ? 'installed' : 'not installed'}`
  );
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildApplySql(mergedPreload: string, preloadChanged: boolean): string {
  const lines: string[] = [];

  if (preloadChanged) {
    lines.push(
      `ALTER SYSTEM SET shared_preload_libraries = '${escapeSqlLiteral(mergedPreload)}';`
    );
  }

  lines.push(
    `ALTER SYSTEM SET log_min_duration_statement = '${TARGET_LOG_MIN_DURATION}';`,
    `ALTER SYSTEM SET auto_explain.log_min_duration = '${TARGET_AUTO_EXPLAIN_MIN_DURATION}';`,
    'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;',
    'SELECT pg_reload_conf();'
  );

  return `${lines.join('\n')}\n`;
}

function settingPendingRestart(
  state: MonitorState,
  name: string
): boolean | null {
  const row = state.settings.find((s) => s.name === name);
  return row === undefined ? null : row.pendingRestart;
}

function pad(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }
  return `${value}${' '.repeat(width - value.length)}`;
}

function formatBool(value: boolean): string {
  return value ? 'true' : 'false';
}

function printSummary(before: MonitorState, after: MonitorState): void {
  console.log('');
  console.log(
    `${pad('Setting', 33)} ${pad('Before', 16)} ${pad('After', 16)} Pending restart`
  );

  const rows: Array<[string, string, string, string]> = [
    [
      'log_min_duration_statement',
      before.logMinDurationStatement,
      after.logMinDurationStatement,
      formatBool(
        settingPendingRestart(after, 'log_min_duration_statement') ?? false
      ),
    ],
    [
      'shared_preload_libraries',
      before.sharedPreloadLibraries || '(empty)',
      after.sharedPreloadLibraries || '(empty)',
      formatBool(
        settingPendingRestart(after, 'shared_preload_libraries') ?? false
      ),
    ],
    [
      'auto_explain.log_min_duration',
      before.autoExplainLogMinDuration,
      after.autoExplainLogMinDuration,
      formatBool(
        settingPendingRestart(after, 'auto_explain.log_min_duration') ?? false
      ),
    ],
    [
      'pg_stat_statements extension',
      formatBool(before.pgStatStatementsInstalled),
      formatBool(after.pgStatStatementsInstalled),
      'n/a',
    ],
  ];

  for (const [name, beforeVal, afterVal, pending] of rows) {
    console.log(
      `${pad(name, 33)} ${pad(beforeVal, 16)} ${pad(afterVal, 16)} ${pending}`
    );
  }

  const needsRestart = after.settings.some((row) => row.pendingRestart);
  if (needsRestart) {
    console.log('');
    log(
      'Note: one or more settings require a server restart before they take full effect (shared_preload_libraries / pg_stat_statements).'
    );
  }

  console.log('');
}

function verifyReloadableSettings(after: MonitorState): void {
  if (after.logMinDurationStatement !== TARGET_LOG_MIN_DURATION) {
    fail(
      `log_min_duration_statement is "${after.logMinDurationStatement}" (expected "${TARGET_LOG_MIN_DURATION}")`
    );
  }

  if (after.autoExplainLogMinDuration !== TARGET_AUTO_EXPLAIN_MIN_DURATION) {
    fail(
      `auto_explain.log_min_duration is "${after.autoExplainLogMinDuration}" (expected "${TARGET_AUTO_EXPLAIN_MIN_DURATION}")`
    );
  }
}

function main(): void {
  const { env } = parseArgs(process.argv.slice(2));

  requireCmd('infisical');
  requireCmd('psql');

  log(`Target environment: ${env}`);

  const databaseUrl = fetchDatabaseUrl(env);
  verifyConnectivity(databaseUrl);

  const before = captureState(databaseUrl);
  logCapturedState('Before:', before);

  const { merged, changed } = mergePreloadLibraries(
    before.sharedPreloadLibraries
  );
  if (changed) {
    log(`Updating shared_preload_libraries → ${merged}`);
  } else {
    log('shared_preload_libraries already includes required libraries');
  }

  psqlExec(databaseUrl, buildApplySql(merged, changed));

  const after = captureState(databaseUrl);
  logCapturedState('After:', after);

  verifyReloadableSettings(after);
  printSummary(before, after);
  log('Done');
}

main();
