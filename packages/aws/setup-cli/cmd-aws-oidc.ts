import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { BaseSetupCommand } from './base-command';
import { PROJECT_CONFIG } from '../project-config';
import {
  deployOidcStackIdempotent,
  OIDC_TEMPLATE_PATH,
} from './shared';

export class AwsOidcCommand extends BaseSetupCommand {
  readonly id = 'aws-oidc';
  readonly summary = 'Idempotent GitHub OIDC CloudFormation stack create/update';

  async execute(_argv: string[]): Promise<void> {
    const region = PROJECT_CONFIG.aws.region;
    process.env['AWS_REGION'] = region;
    process.env['AWS_DEFAULT_REGION'] = region;

    const client = new CloudFormationClient({ region });
    const roleArn = await deployOidcStackIdempotent(
      client,
      PROJECT_CONFIG.aws.bootstrapStackName,
      OIDC_TEMPLATE_PATH,
      [
        {
          ParameterKey: 'GitHubOrg',
          ParameterValue: PROJECT_CONFIG.github.owner,
        },
        {
          ParameterKey: 'GitHubRepo',
          ParameterValue: PROJECT_CONFIG.github.repo,
        },
      ]
    );
    console.log(`OIDC deploy role: ${roleArn}`);
  }
}
