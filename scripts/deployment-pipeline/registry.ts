import assert from 'node:assert/strict';
import type { PipelineCommand } from './base-command';
import { AssertAwsCommand } from './cmd-assert-aws';
import { CdkDeployCommand } from './cmd-cdk-deploy';
import { DeployPatchDbAppCommand } from './cmd-deploy-patch-db-app';
import { DeployWebAppCommand } from './cmd-deploy-web-app';
import { CfnGateCommand } from './cmd-gate';
import { PreCdkCommand } from './cmd-pre-cdk';
import { ReadCdkOutputsCommand } from './cmd-read-cdk-outputs';
import { RequireAwsSecretsCommand } from './cmd-require-aws-secrets';
import { WriteDeploySummaryCommand } from './cmd-write-deploy-summary';

export const COMMAND_REGISTRY: PipelineCommand[] = [
  new RequireAwsSecretsCommand(),
  new AssertAwsCommand(),
  new CfnGateCommand(),
  new PreCdkCommand(),
  new ReadCdkOutputsCommand(),
  new CdkDeployCommand(),
  new DeployWebAppCommand(),
  new DeployPatchDbAppCommand(),
  new WriteDeploySummaryCommand(),
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
