import { runWithInfisicalSecrets } from './impl-infisical/cli-run';

export type RunWithSecretsOptions = {
  readonly repoRoot: string;
  readonly childArgs: readonly string[];
};

/**
 * Run a command with secrets injected from the configured secrets backend.
 */
export function runWithSecrets(options: RunWithSecretsOptions): number {
  return runWithInfisicalSecrets(options);
}
