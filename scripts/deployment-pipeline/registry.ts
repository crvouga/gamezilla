import assert from 'node:assert/strict';
import type { PipelineCommand } from './base-command';
import { CdkDeployCommand } from './cmd-cdk-deploy';
import { DeployAppsCommand } from './cmd-deploy-apps';
import { PreflightCommand } from './cmd-preflight';

export const COMMAND_REGISTRY: PipelineCommand[] = [
  new PreflightCommand(),
  new CdkDeployCommand(),
  new DeployAppsCommand(),
];

assert(COMMAND_REGISTRY.length > 0, 'COMMAND_REGISTRY must not be empty');
const registryIds = COMMAND_REGISTRY.map((c) => c.id);
assert.strictEqual(
  new Set(registryIds).size,
  registryIds.length,
  'COMMAND_REGISTRY: duplicate command id'
);

export function printUsage(): void {
  const width = Math.max(...COMMAND_REGISTRY.map((c) => c.id.length));
  assert(Number.isFinite(width) && width > 0);
  const lines = COMMAND_REGISTRY.map(
    (c) => `  ${c.id.padEnd(width)}  ${c.summary}`
  );
  console.error(
    `Usage: bun run scripts/deployment-pipeline.ts <command>\n\n${lines.join('\n')}`
  );
}
