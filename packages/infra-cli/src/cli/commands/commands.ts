import { fmt } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

import { ApplyCommand } from './apply';
import { BootstrapCommand } from './bootstrap';
import { CheckCommand } from './check';
import { DeployCommand } from './deploy';
import { DeployAppsCommand } from './deploy-apps';
import { DomainsSetupCommand } from './domains-setup';
import { FetchSecretsCommand } from './fetch-secrets';
import { InstallDepsCommand } from './install-deps';
import { PostDeployCommand } from './post-deploy';
import { PreDeployCommand } from './pre-deploy';
import { SetupSecretsCommand } from './setup-secrets';
import { StatusCommand } from './status';
import { SummaryCommand } from './summary';

export function createRegistry(platform: CiPlatform): Command[] {
  return [
    new BootstrapCommand(platform),
    new CheckCommand(platform),
    new DeployCommand(platform),
    new InstallDepsCommand(platform),
    new StatusCommand(platform),
    new ApplyCommand(platform),
    new DeployAppsCommand(platform),
    new PostDeployCommand(platform),
    new PreDeployCommand(platform),
    new SummaryCommand(platform),
    new DomainsSetupCommand(platform),
    new FetchSecretsCommand(platform),
    new SetupSecretsCommand(platform),
  ];
}

/** Known prefixes and display order. Commands without a prefix go first. */
const GROUP_ORDER = ['', 'ci', 'domains', 'secrets'] as const;
const GROUP_LABELS: Record<string, string> = {
  ci: 'CI',
  domains: 'Domains',
  secrets: 'Secrets',
};

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
