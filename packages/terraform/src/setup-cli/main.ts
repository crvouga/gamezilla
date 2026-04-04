import { createSetupRegistry, printUsage } from './registry';

export async function main(): Promise<void> {
  const argv = process.argv;
  const commands = createSetupRegistry();
  const command = commands.find((c) => c.match(argv));

  if (command === undefined) {
    printUsage(commands);
    console.error(`Unknown command: ${argv[2] ?? '(none)'}`);
    process.exit(1);
  }

  await Promise.resolve(command.execute(argv));
}
