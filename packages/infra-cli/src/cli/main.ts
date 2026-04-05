import type { CiPlatform } from './platform';
import { createRegistry, printHelp } from './registry';
import { fail } from './fmt';

export async function main(platform: CiPlatform): Promise<void> {
  const commandId = process.argv[2];
  const commands = createRegistry(platform);

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
