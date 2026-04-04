import { assert } from '@gamezilla/shared/assert';
import type { PipelineCommand } from './base-command';
import type { CiPlatform } from './ci-platform';
import { DeployCommand } from './cmd-deploy';
import { DeployAppsCommand } from './cmd-deploy-apps';
import { PostDeployCommand } from './cmd-post-deploy';
import { PreflightCommand } from './cmd-preflight';
import { WriteSummaryCommand } from './cmd-write-summary';

export function createCommandRegistry(platform: CiPlatform): PipelineCommand[] {
  const commands: PipelineCommand[] = [
    new PreflightCommand(platform),
    new DeployCommand(platform),
    new DeployAppsCommand(platform),
    new PostDeployCommand(platform),
    new WriteSummaryCommand(platform),
  ];

  assert.ok(commands.length > 0, 'createCommandRegistry: must not be empty');
  const ids = commands.map((c) => c.id);
  assert.equals(new Set(ids).size, ids.length, 'createCommandRegistry: duplicate command id');
  return commands;
}

export function printUsage(commands: PipelineCommand[]): void {
  const width = Math.max(...commands.map((c) => c.id.length));
  const lines = commands.map((c) => `  ${c.id.padEnd(width)}  ${c.summary}`);
  console.error(`Usage: bun run terraform/bin/deployment-pipeline-cli.ts <command>\n\n${lines.join('\n')}`);
}
