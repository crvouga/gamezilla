import { BaseSetupCommand } from './base-command';
import { deployOidcStackIdempotent } from './shared';
import { PROJECT_CONFIG } from '../project-config';

export class AwsOidcCommand extends BaseSetupCommand {
  readonly id = 'aws-oidc';
  readonly summary = 'Idempotent GitHub OIDC CloudFormation stack';

  async execute(): Promise<void> {
    process.env['AWS_REGION'] = PROJECT_CONFIG.aws.region;
    const roleArn = await deployOidcStackIdempotent();
    console.log(`\nOIDC RoleArn: ${roleArn}`);
  }
}
