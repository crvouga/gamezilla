import { BaseSetupCommand } from './base-command';
import { AwsOidcCommand } from './cmd-aws-oidc';
import { CdkBootstrapCommand } from './cmd-cdk-bootstrap';
import { CheckCommand } from './cmd-check';
import { GitHubCommand } from './cmd-github';

/** Runs: check → aws-oidc → cdk-bootstrap → github (stop on first failure). */
export class AllCommand extends BaseSetupCommand {
  readonly id = 'all';
  readonly summary =
    'Orchestrator: check, aws-oidc, cdk-bootstrap, github in sequence';

  async execute(argv: string[]): Promise<void> {
    const steps = [
      new CheckCommand(),
      new AwsOidcCommand(),
      new CdkBootstrapCommand(),
      new GitHubCommand(),
    ];
    for (const step of steps) {
      console.log(`\n---------- setup ${step.id} ----------\n`);
      await Promise.resolve(step.execute(argv));
    }
    console.log(
      '\nsetup all: complete. CI can deploy with OIDC. Optional: bun run setup deploy\n'
    );
  }
}
