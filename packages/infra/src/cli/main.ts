import { createCommandRegistry, printHelp } from './commands/commands';
import { fail } from './lib/fmt';
import type { CiPlatform } from './platform/platform';

export async function main(platform: CiPlatform): Promise<void> {
  const commandId = process.argv[2];
  const commands = createCommandRegistry(platform);

  if (!commandId || commandId === '--help' || commandId === '-h') {
    printHelp(commands);
    process.exit(0);
  }

  const command = commands.find((c) => c.id === commandId);

  if (!command) {
    printHelp(commands);
    fail('Unknown command', commandId);
    process.exit(1);
  }

  await Promise.resolve(command.execute());
}
