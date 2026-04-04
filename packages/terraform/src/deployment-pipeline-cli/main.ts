import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';
import { createCommandRegistry, printUsage } from './registry';

export async function main(platform: CiPlatform): Promise<void> {
  const argv = process.argv;
  assert.array(argv, 'main: argv must be an array');

  const commands = createCommandRegistry(platform);
  const command = commands.find((c) => c.match(argv));

  if (command === undefined) {
    printUsage(commands);
    platform.error(`Unknown command: ${argv[2] ?? '(none)'}`);
    assert.fail(`main: unrecognized command "${argv[2] ?? '(none)'}"`);
  }

  await Promise.resolve(command.execute(argv));
}
