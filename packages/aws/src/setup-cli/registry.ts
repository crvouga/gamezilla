import type { SetupCommand } from './base-command';
import { AllCommand } from './cmd-all';
import { AwsOidcCommand } from './cmd-aws-oidc';
import { CdkBootstrapCommand } from './cmd-cdk-bootstrap';
import { CheckCommand } from './cmd-check';
import { DeployCommand } from './cmd-deploy';
import { DomainsBootstrapCommand } from './cmd-domains-bootstrap';
import { DomainsFinalizeCommand } from './cmd-domains-finalize';
import { DomainsStatusCommand } from './cmd-domains-status';
import { GitHubCommand } from './cmd-github';
import { StatusCommand } from './cmd-status';

export function createSetupRegistry(): SetupCommand[] {
  return [
    new CheckCommand(),
    new AwsOidcCommand(),
    new CdkBootstrapCommand(),
    new GitHubCommand(),
    new DeployCommand(),
    new DomainsBootstrapCommand(),
    new DomainsFinalizeCommand(),
    new DomainsStatusCommand(),
    new StatusCommand(),
    new AllCommand(),
  ];
}

export function printUsage(commands: SetupCommand[]): void {
  const width = Math.max(...commands.map((c) => c.id.length), 1);
  const lines = commands.map(
    (c) => `  ${c.id.padEnd(width)}  ${c.summary}`
  );
  console.error(
    `Usage: bun run setup <command>\n\nFrom packages/aws:\n\n${lines.join(
      '\n'
    )}\n`
  );
}
