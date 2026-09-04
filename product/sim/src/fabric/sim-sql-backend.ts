/**
 * Single flag for which SQL engines `@product/sim` use.
 *
 * - `real` (default): PGlite server + real SQLite clients
 *   (browser → SQLite WASM; Node/bun → better-sqlite3 / bun:sqlite)
 * - `mem`: postgres-mem + sqlite-mem (legacy A/B)
 *
 * Override: `SIM_SQL_BACKEND=mem|real`
 *
 * Native Expo (iOS/Android) always uses mem engines: Hermes cannot load
 * better-sqlite3, bun:sqlite, or PGlite WASM. `SIM_SQL_BACKEND=real` still
 * maps to mem on native via `sim-sql-backend-real.native.ts`.
 */

export type SimSqlBackend = 'mem' | 'real';

export type SimSqlRuntime = 'browser' | 'node';

/** Default when env is unset — plan default is real engines. */
export const DEFAULT_SIM_SQL_BACKEND: SimSqlBackend = 'real';

export function resolveSimSqlRuntime(): SimSqlRuntime {
  // Real browser playground (no bun:test): WASM clients.
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Bun === 'undefined'
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
