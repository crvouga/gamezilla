import type { Command } from './commands/types';
import { runWithGlobalLock } from './lib/global-lock-session';
import type { CiPlatform } from './platform/platform';
import { SecretsResource } from './resources/secrets';

/**
 * Runs a command; acquires the global lock when {@link Command.requiresLock} is set.
 *
 * {@link DeployCommand} defers lock acquisition until after `db:migrate` so
 * Postgres connection limits are not exhausted (lock + migrate).
 */
export async function runInfraCommand(
  command: Command,
  platform: CiPlatform
): Promise<void> {
  if (command.id !== 'setup' && command.id !== 'pipeline-report') {
    await new SecretsResource().loadSecretsQuick();
  }

  if (command.requiresLock !== true) {
    await command.execute();
    return;
  }

  await runWithGlobalLock(platform, command.id, async () => {
    await command.execute();
  });
}
