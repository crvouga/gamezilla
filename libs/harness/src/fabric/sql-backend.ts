/**
 * Harness SQL fabric id. In-process harness always uses mockingbird-postgres + mockingbird-sqlite.
 * Fidelity-max / `HARNESS_MODE=real` uses postgres-embedded outside this fabric.
 */

export type HarnessSqlBackend = 'mem';

export type HarnessSqlRuntime = 'browser' | 'node';

export const DEFAULT_HARNESS_SQL_BACKEND: HarnessSqlBackend = 'mem';

export function resolveHarnessSqlRuntime(): HarnessSqlRuntime {
  // Real browser product-harness (no bun:test): WASM clients if ever needed.
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Bun === 'undefined'
  ) {
    return 'browser';
  }
  return 'node';
}

/** Always `mem` — in-process harness fabric is mockingbird-postgres only. */
export function resolveHarnessSqlBackend(
  _env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): HarnessSqlBackend {
  return DEFAULT_HARNESS_SQL_BACKEND;
}
