/**
 * GitHub Actions CI entrypoint: AWS secrets, CloudFormation gate, CDK deploy, artifact sync, summaries.
 * Usage: bun run scripts/ci.ts <command>
 */
import assert from 'node:assert/strict';
import { CI_COMMAND_REGISTRY, printUsage } from './registry';

export async function main(): Promise<void> {
  const argv = process.argv;
  assert(Array.isArray(argv));
  assert(CI_COMMAND_REGISTRY.length > 0);
  const command = CI_COMMAND_REGISTRY.find((c) => c.match(argv));
  if (command === undefined) {
    printUsage();
    process.exit(2);
  }
  assert(command !== undefined && command !== null);
  await Promise.resolve(command.execute(argv));
}
