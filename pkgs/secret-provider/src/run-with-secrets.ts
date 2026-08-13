import { runWithInfisicalSecrets } from './impl-infisical/cli-run';
import type { ObjectStore } from '@pkgs/object-store/interface';

export type RunWithSecretsOptions = {
  readonly repoRoot: string;
  readonly configStore: ObjectStore;
  readonly childArgs: readonly string[];
};

/**
 * Run a command with secrets injected from the configured secrets backend.
 */
export async function runWithSecrets(
  options: RunWithSecretsOptions
): Promise<number> {
  return runWithInfisicalSecrets(options);
}
