import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { BaseSetupCommand } from './base-command';
import { PROJECT_CONFIG } from '../project-config';
import { gh, ghQuiet, requireStackOutput } from './shared';

const GH_REPO = `${PROJECT_CONFIG.github.owner}/${PROJECT_CONFIG.github.repo}`;

export class GitHubCommand extends BaseSetupCommand {
  readonly id = 'github';
  readonly summary =
    'Set GitHub Actions AWS variables from OIDC stack; remove legacy static-key secrets';

  async execute(_argv: string[]): Promise<void> {
    const region = PROJECT_CONFIG.aws.region;
    process.env['AWS_REGION'] = region;
    process.env['AWS_DEFAULT_REGION'] = region;

    const client = new CloudFormationClient({ region });
    const roleArn = await requireStackOutput(
      client,
      PROJECT_CONFIG.aws.bootstrapStackName,
      'RoleArn'
    );

    console.log(`Setting GitHub variables on ${GH_REPO}…`);
    gh(['variable', 'set', 'AWS_ROLE_ARN', '--body', roleArn, '-R', GH_REPO]);
    gh(['variable', 'set', 'AWS_REGION', '--body', region, '-R', GH_REPO]);

    console.log('Removing legacy static-key secrets if present…');
    ghQuiet(['secret', 'remove', 'AWS_ACCESS_KEY_ID', '-R', GH_REPO]);
    ghQuiet(['secret', 'remove', 'AWS_SECRET_ACCESS_KEY', '-R', GH_REPO]);

    console.log('--- gh variable list ---');
    gh(['variable', 'list', '-R', GH_REPO]);
  }
}
