import { fmt } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import type { Command, CommandGroup } from './types';

import { DeployCommand } from './deploy';
import { DeployResourcesCommand } from './deploy-resources';
import { DestroyCommand } from './destroy';
import { LockAcquireCommand } from './lock-acquire';
import { LockReleaseCommand } from './lock-release';
import { MigrateCommand } from './migrate';
import { PipelineReportCommand } from './pipeline-report';
import { ProvisionCommand } from './provision';
import { RefreshConfigCommand } from './refresh-config';
import { SetupCommand } from './setup';
import { SmokeCommand } from './smoke';
import { StatusCommand } from './status';
import { StripeSyncCommand } from './stripe-sync';
import { UnlockCommand } from './unlock';

/** Display order for grouped help output. */
export const COMMAND_GROUP_ORDER: readonly CommandGroup[] = [
  'setup',
  'lifecycle',
  'phase',
  'ci',
] as const;

export const COMMAND_GROUP_LABELS: Record<CommandGroup, string> = {
  setup: 'Setup & health',
  lifecycle: 'Deploy & destroy',
  phase: 'Deploy phases (CI atomic)',
  ci: 'CI & reporting',
};

export function createCommandRegistry(platform: CiPlatform): Command[] {
  return [
    new SetupCommand(platform),
    new StatusCommand(platform),
    new DeployCommand(platform),
    new DestroyCommand(platform),
    new UnlockCommand(platform),
    new LockAcquireCommand(platform),
    new LockReleaseCommand(platform),
    new ProvisionCommand(platform),
    new MigrateCommand(platform),
    new DeployResourcesCommand(platform),
    new StripeSyncCommand(platform),
    new SmokeCommand(platform),
    new RefreshConfigCommand(platform),
    new PipelineReportCommand(platform),
  ];
}

export function printHelp(commands: Command[]): void {
  console.log('');
  console.log(fmt.bold('infra') + fmt.dim(' — gamezilla infrastructure CLI'));
  console.log('');
  console.log(`Usage: ${fmt.cyan('bun run infra <command>')}`);

  for (const group of COMMAND_GROUP_ORDER) {
    const cmds = commands.filter((c) => c.group === group);
    if (cmds.length === 0) continue;

    console.log('');
    console.log(fmt.dim(`  ${COMMAND_GROUP_LABELS[group]}`));
    const width = Math.max(...cmds.map((c) => c.id.length));
    for (const c of cmds) {
      const tag = c.danger ? ` ${fmt.red('(destructive)')}` : '';
      console.log(`  ${fmt.green(c.id.padEnd(width))}  ${c.summary}${tag}`);
    }
  }
  console.log('');
}
