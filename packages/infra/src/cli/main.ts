import { createCommandRegistry, printHelp } from './commands/commands';
import { runInteractive } from './interactive';
import { fail } from './lib/fmt';
import { isHumanInteractiveSession } from './lib/interactive-env';
import type { CiPlatform } from './platform/platform';
import { runInfraCommand } from './run-infra-command';

export async function main(platform: CiPlatform): Promise<void> {
  const commandId = process.argv[2];
  const commands = createCommandRegistry(platform);

  if (commandId === '--help' || commandId === '-h') {
    printHelp(commands);
    process.exit(0);
  }

  if (!commandId) {
    if (!isHumanInteractiveSession()) {
      printHelp(commands);
      fail(
        'infra',
        'interactive mode needs a local terminal — in CI or scripts pass a command (e.g. `bun run infra deploy`)'
      );
      process.exit(1);
    }
    await runInteractive(commands, platform);
    return;
  }

  const command = commands.find((c) => c.id === commandId);

  if (!command) {
    printHelp(commands);
    fail('Unknown command', commandId);
    process.exit(1);
  }

  await runInfraCommand(command, platform);
}
