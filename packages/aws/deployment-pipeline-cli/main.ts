/**
 * Deployment pipeline entrypoint: AWS credentials (OIDC or env), CloudFormation gate, CDK deploy, artifact sync, summaries.
 * Usage: bun run aws/bin/deployment-pipeline-cli.ts <command>
 */
import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';
import { createCommandRegistry, printUsage } from './registry';

export async function main(platform: CiPlatform): Promise<void> {
  const argv = process.argv;
  assert.array(argv, 'main: argv must be an array');

  const commands = createCommandRegistry(platform);
  assert.ok(commands.length > 0, 'main: command registry must not be empty');

  const command = commands.find((c) => c.match(argv));
  if (command === undefined) {
    printUsage(commands);
    platform.error(`Unknown command: ${argv[2] ?? '(none)'}`);
    assert.fail(
      `main: unrecognized command "${argv[2] ?? '(none)'}" — crash, do not continue`
    );
  }

  assert.defined(command, 'main: command must be defined');
  await Promise.resolve(command.execute(argv));
}
