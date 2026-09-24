/**
 * Sim SQL fabric id. In-process sim always uses mockingbird-postgres + mockingbird-sqlite.
 * Fidelity-max / `SIM_MODE=real` uses postgres-embedded outside this fabric.
 */

export type SimSqlBackend = 'mem';

export type SimSqlRuntime = 'browser' | 'node';

export const DEFAULT_SIM_SQL_BACKEND: SimSqlBackend = 'mem';

export function resolveSimSqlRuntime(): SimSqlRuntime {
  // Real browser product-simulator (no bun:test): WASM clients if ever needed.
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Bun === 'undefined'
  ) {
    return 'browser';
  }
  return 'node';
}

/** Always `mem` — in-process sim fabric is mockingbird-postgres only. */
export function resolveSimSqlBackend(
  _env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): SimSqlBackend {
  return DEFAULT_SIM_SQL_BACKEND;
}
