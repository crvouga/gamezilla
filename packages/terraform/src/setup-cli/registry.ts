import type { SetupCommand } from './base-command';
import { AllCommand } from './cmd-all';
import { AwsOidcCommand } from './cmd-aws-oidc';
import { CheckCommand } from './cmd-check';
import { SetupDeployCommand } from './cmd-deploy';
import { DomainsBootstrapCommand } from './cmd-domains-bootstrap';
import { DomainsFinalizeCommand } from './cmd-domains-finalize';
import { DomainsStatusCommand } from './cmd-domains-status';
import { GitHubCommand } from './cmd-github';
import { StatusCommand } from './cmd-status';

export function createSetupRegistry(): SetupCommand[] {
  return [
    new CheckCommand(),
    new AwsOidcCommand(),
    new GitHubCommand(),
    new AllCommand(),
    new SetupDeployCommand(),
    new DomainsBootstrapCommand(),
    new DomainsFinalizeCommand(),
    new DomainsStatusCommand(),
    new StatusCommand(),
  ];
}

export function printUsage(commands: SetupCommand[]): void {
  const width = Math.max(...commands.map((c) => c.id.length));
  const lines = commands.map((c) => `  ${c.id.padEnd(width)}  ${c.summary}`);
  console.error(`Usage: bun run setup <command>\n\n${lines.join('\n')}`);
}
