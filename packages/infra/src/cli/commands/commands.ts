import { fmt } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

import { DeployCommand } from './deploy';
import { DestroyCommand } from './destroy';
import { SetupCommand } from './setup';
import { StatusCommand } from './status';

export function createRegistry(platform: CiPlatform): Command[] {
  return [
    new SetupCommand(platform),
    new StatusCommand(platform),
    new DeployCommand(platform),
    new DestroyCommand(platform),
  ];
}

/** Known prefixes and display order. Commands without a prefix go first. */
const GROUP_ORDER = [''] as const;
const GROUP_LABELS: Record<string, string> = {};

function commandPrefix(id: string): string {
  const dash = id.indexOf('-');
  if (dash === -1) return '';
  const prefix = id.slice(0, dash);
  return prefix in GROUP_LABELS ? prefix : '';
}

export function printHelp(commands: Command[]): void {
  console.log('');
  console.log(fmt.bold('infra') + fmt.dim(' — gamezilla infrastructure CLI'));
  console.log('');
  console.log(`Usage: ${fmt.cyan('bun run infra <command>')}`);

  for (const group of GROUP_ORDER) {
    const cmds = commands.filter((c) => commandPrefix(c.id) === group);
    if (cmds.length === 0) continue;

    console.log('');
    if (group) console.log(fmt.dim(`  ${GROUP_LABELS[group]}`));
    const width = Math.max(...cmds.map((c) => c.id.length));
    for (const c of cmds) {
      console.log(`  ${fmt.green(c.id.padEnd(width))}  ${c.summary}`);
    }
  }
  console.log('');
}
