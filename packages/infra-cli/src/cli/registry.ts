import type { Command, CommandGroup } from './command';
import { fmt } from './fmt';
import type { CiPlatform } from './platform';

import { CheckCommand } from './commands/check';
import { DeployCommand } from './commands/deploy';
import { InstallDepsCommand } from './commands/install-deps';
import { SetupSecretsCommand } from './commands/setup-secrets';
import { StatusCommand } from './commands/status';

import { DomainsSetupCommand } from './commands/domains-setup';

import { ApplyCommand } from './commands/apply';
import { DeployAppsCommand } from './commands/deploy-apps';
import { FetchSecretsCommand } from './commands/fetch-secrets';
import { PostDeployCommand } from './commands/post-deploy';
import { PreflightCommand } from './commands/preflight';
import { SummaryCommand } from './commands/summary';

export function createRegistry(platform: CiPlatform): Command[] {
  return [
    new CheckCommand(platform),
    new InstallDepsCommand(platform),
    new DeployCommand(platform),
    new SetupSecretsCommand(platform),
    new StatusCommand(platform),
    new DomainsSetupCommand(platform),
    new FetchSecretsCommand(platform),
    new PreflightCommand(platform),
    new ApplyCommand(platform),
    new DeployAppsCommand(platform),
    new PostDeployCommand(platform),
    new SummaryCommand(platform),
  ];
}

const GROUP_ORDER: CommandGroup[] = ['main', 'domains', 'ci'];
const GROUP_LABELS: Record<CommandGroup, string> = {
  main: 'Main',
  domains: 'Domains',
  ci: 'CI Pipeline',
};

export function printHelp(commands: Command[]): void {
  console.log('');
  console.log(fmt.bold('infra') + fmt.dim(' — gamezilla infrastructure CLI'));
  console.log('');
  console.log(`Usage: ${fmt.cyan('bun run infra <command>')}`);

  for (const group of GROUP_ORDER) {
    const cmds = commands.filter((c) => c.group === group);
    if (cmds.length === 0) continue;

    console.log('');
    console.log(fmt.dim(`  ${GROUP_LABELS[group]}`));
    const width = Math.max(...cmds.map((c) => c.id.length));
    for (const c of cmds) {
      console.log(`  ${fmt.green(c.id.padEnd(width))}  ${c.summary}`);
    }
  }
  console.log('');
}
