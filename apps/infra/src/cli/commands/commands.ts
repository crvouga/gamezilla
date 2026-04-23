import { fmt } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import type { Command, CommandGroup } from './types';

import { DeployCommand } from './deploy';
import { DestroyCommand } from './destroy';
import { SetupCommand } from './setup';
import { UnlockCommand } from './unlock';
import { StatusCommand } from './status';

/** Display order for grouped help output. */
export const COMMAND_GROUP_ORDER: readonly CommandGroup[] = [
  'setup',
  'lifecycle',
] as const;

export const COMMAND_GROUP_LABELS: Record<CommandGroup, string> = {
  setup: 'Setup & health',
  lifecycle: 'Deploy & destroy',
};

export function createCommandRegistry(platform: CiPlatform): Command[] {
  return [
    new SetupCommand(platform),
    new StatusCommand(platform),
    new DeployCommand(platform),
    new DestroyCommand(platform),
    new UnlockCommand(platform),
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
