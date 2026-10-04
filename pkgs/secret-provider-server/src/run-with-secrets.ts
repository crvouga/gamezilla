import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import type { SecretsEnvs } from '@pkgs/secret-provider-shared/local-secrets-cache';
import { runWithInfisicalSecrets } from './cli-run';

export type RunWithSecretsOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: readonly string[];
  /** Which environments exist and which are production (caller decides). */
  readonly envs: SecretsEnvs;
  /** Injected wall clock (ms) for cache stale checks. */
  readonly nowMs: number;
  /** Injected wall clock ISO for cache meta `pulledAt`. */
  readonly nowIso: string;
};

/**
 * Run a command with secrets injected from the configured secrets backend.
 */
export async function runWithSecrets(
  options: RunWithSecretsOptions
): Promise<number> {
  return runWithInfisicalSecrets(options);
}
