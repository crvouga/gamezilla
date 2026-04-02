import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { BaseSetupCommand } from './base-command';
import { CdkDeployCommand } from '../deployment-pipeline-cli/cmd-cdk-deploy';
import { DeployAppsCommand } from '../deployment-pipeline-cli/cmd-deploy-apps';
import { readCdkOutputs } from '../deployment-pipeline-cli/cdk-outputs';
import { runHttpSmokeTestsOnly } from '../deployment-pipeline-cli/cmd-post-deploy';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { PROJECT_CONFIG } from '../project-config';
import { assertCdkToolkitExists, requireStackOutput } from './shared';

export class DeployCommand extends BaseSetupCommand {
  readonly id = 'deploy';
  readonly summary =
    'One-off CDK deploy (custom domain bootstrap) + sync apps + HTTP smoke tests';

  async execute(argv: string[]): Promise<void> {
    const region = PROJECT_CONFIG.aws.region;
    process.env['AWS_REGION'] = region;
    process.env['AWS_DEFAULT_REGION'] = region;

    const client = new CloudFormationClient({ region });
    await requireStackOutput(
      client,
      PROJECT_CONFIG.aws.bootstrapStackName,
      'RoleArn'
    );
    await assertCdkToolkitExists(client);

    const platform = new LocalPlatform();
    platform.notice('Running CDK deploy (customDomain=true, customDomainBootstrap=true)…');
    await new CdkDeployCommand(platform).execute(argv);
    platform.notice('Deploying web artifacts…');
    await new DeployAppsCommand(platform).execute(argv);

    const outputs = readCdkOutputs(platform);
    await runHttpSmokeTestsOnly(platform, outputs);

    console.log('\nDeployed URLs (from CDK outputs):');
    console.log(`  WebAppUrl:             ${outputs.WebAppUrl ?? '(missing)'}`);
    console.log(`  ReqResUrl:             ${outputs.ReqResUrl ?? '(missing)'}`);
    console.log(
      `  DatabaseClusterEndpoint: ${outputs.DatabaseClusterEndpoint ?? '(missing)'}`
    );
    console.log(
      `  PubSubInternalMqttUrl: ${outputs.PubSubInternalMqttUrl ?? '(missing)'}`
    );
    console.log(
      `  PubSubPublicNlbDns:    ${outputs.PubSubPublicNlbDns ?? '(missing)'}\n`
    );
  }
}
