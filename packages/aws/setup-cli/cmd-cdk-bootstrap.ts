import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { BaseSetupCommand } from './base-command';
import { PROJECT_CONFIG } from '../project-config';
import { AWS_PACKAGE_ROOT, runLocal } from './shared';

export class CdkBootstrapCommand extends BaseSetupCommand {
  readonly id = 'cdk-bootstrap';
  readonly summary = 'CDK bootstrap for current account and configured region';

  async execute(_argv: string[]): Promise<void> {
    const region = PROJECT_CONFIG.aws.region;
    process.env['AWS_REGION'] = region;
    process.env['AWS_DEFAULT_REGION'] = region;

    const sts = new STSClient({ region });
    const id = await sts.send(new GetCallerIdentityCommand({}));
    const account = id.Account;
    if (account === undefined || account === '') {
      throw new Error('STS GetCallerIdentity: missing account');
    }
    console.log(`CDK bootstrap aws://${account}/${region} …`);
    runLocal('bunx', ['cdk', 'bootstrap', `aws://${account}/${region}`], {
      cwd: AWS_PACKAGE_ROOT,
    });
  }
}
