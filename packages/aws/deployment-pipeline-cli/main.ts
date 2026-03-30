/**
 * Deployment pipeline entrypoint: AWS credentials (OIDC or env), CloudFormation gate, CDK deploy, artifact sync, summaries.
 * Usage: bun run aws/bin/deployment-pipeline-cli.ts <command>
 */
import assert from 'node:assert/strict';
import { reportError } from './ci-platform';
import { COMMAND_REGISTRY, printUsage } from './registry';

export async function main(): Promise<void> {
  const argv = process.argv;
  assert(Array.isArray(argv));
  assert(COMMAND_REGISTRY.length > 0);

  const command = COMMAND_REGISTRY.find((c) => c.match(argv));
  if (command === undefined) {
    printUsage();
    reportError(`Unknown command: ${argv[2] ?? '(none)'}`);
    assert.fail(
      `main: unrecognized command "${argv[2] ?? '(none)'}" — crash, do not continue`
    );
  }

  assert(command !== undefined && command !== null);
  await Promise.resolve(command.execute(argv));
}
