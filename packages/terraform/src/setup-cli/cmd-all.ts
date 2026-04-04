import { BaseSetupCommand } from './base-command';
import { CheckCommand } from './cmd-check';
import { AwsOidcCommand } from './cmd-aws-oidc';
import { GitHubCommand } from './cmd-github';

export class AllCommand extends BaseSetupCommand {
  readonly id = 'all';
  readonly summary = 'Run check → aws-oidc → github (full bootstrap)';

  async execute(): Promise<void> {
    const steps: BaseSetupCommand[] = [
      new CheckCommand(),
      new AwsOidcCommand(),
      new GitHubCommand(),
    ];

    for (const step of steps) {
      console.log(`\n=== ${step.id} ===`);
      await step.execute([]);
    }

    console.log('\n=== Bootstrap complete ===');
    console.log('Next: run "bun run setup deploy" to deploy infrastructure.');
  }
}
