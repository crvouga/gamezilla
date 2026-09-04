/**
 * Single flag for which SQL engines `@sim/console` / `@sim/test` use.
 *
 * - `real` (default): PGlite server + real SQLite clients
 *   (browser → SQLite WASM; Node/Jest → better-sqlite3 / bun:sqlite)
 * - `mem`: postgres-mem + sqlite-mem (legacy A/B)
 *
 * Override: `SIM_SQL_BACKEND=mem|real`
 */

export type SimSqlBackend = 'mem' | 'real';

export type SimSqlRuntime = 'browser' | 'node';

/** Default when env is unset — plan default is real engines. */
export const DEFAULT_SIM_SQL_BACKEND: SimSqlBackend = 'mem';

export function resolveSimSqlRuntime(): SimSqlRuntime {
  // Real browser playground (no Jest): WASM clients.
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    (typeof process === 'undefined' ||
      process.env['JEST_WORKER_ID'] === undefined)
  ) {
    return 'browser';
  }
  return 'node';
}

export function resolveSimSqlBackend(
  env:
    | NodeJS.ProcessEnv
    | Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {}
): SimSqlBackend {
  const raw = env['SIM_SQL_BACKEND']?.trim().toLowerCase();
  if (raw === 'mem' || raw === 'real') return raw;
  return DEFAULT_SIM_SQL_BACKEND;
}
