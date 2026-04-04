import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { BaseSetupCommand } from './base-command';
import { gh, ghQuiet, requireStackOutput } from './shared';
import { PROJECT_CONFIG } from '../project-config';

export class GitHubCommand extends BaseSetupCommand {
  readonly id = 'github';
  readonly summary = 'Set GHA AWS variables; remove legacy secrets';

  async execute(): Promise<void> {
    const client = new CloudFormationClient({ region: PROJECT_CONFIG.aws.region });
    const roleArn = await requireStackOutput(
      client,
      PROJECT_CONFIG.aws.bootstrapStackName,
      'RoleArn'
    );

    gh(['variable', 'set', 'AWS_ROLE_ARN', '--body', roleArn]);
    gh(['variable', 'set', 'AWS_REGION', '--body', PROJECT_CONFIG.aws.region]);

    ghQuiet(['secret', 'delete', 'AWS_ACCESS_KEY_ID']);
    ghQuiet(['secret', 'delete', 'AWS_SECRET_ACCESS_KEY']);

    gh(['variable', 'list']);
    console.log('\nGitHub Actions variables set.');
  }
}
