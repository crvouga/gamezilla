import { BaseSetupCommand } from './base-command';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { DeployCommand } from '../deployment-pipeline-cli/cmd-deploy';
import { DeployAppsCommand } from '../deployment-pipeline-cli/cmd-deploy-apps';
import { runHttpSmokeTestsOnly } from '../deployment-pipeline-cli/cmd-post-deploy';
import { readTfOutputs, requireOutput } from '../deployment-pipeline-cli/tf-outputs';
import { PROJECT_CONFIG } from '../project-config';

export class SetupDeployCommand extends BaseSetupCommand {
  readonly id = 'deploy';
  readonly summary = 'Full deploy: terraform apply + apps + HTTP smoke';

  async execute(): Promise<void> {
    process.env['AWS_REGION'] = process.env['AWS_REGION'] ?? PROJECT_CONFIG.aws.region;

    const platform = new LocalPlatform();
    const argv = ['', '', 'deploy'];

    const deployCmd = new DeployCommand(platform);
    await deployCmd.execute(argv);

    const deployAppsCmd = new DeployAppsCommand(platform);
    await deployAppsCmd.execute(argv);

    const outputs = readTfOutputs(platform);
    await runHttpSmokeTestsOnly(platform, outputs);

    console.log('\n=== Deploy complete ===');
    const urlKeys = ['web_app_url', 'req_res_url'] as const;
    for (const key of urlKeys) {
      try {
        console.log(`  ${key}: ${requireOutput(platform, outputs, key)}`);
      } catch { /* not available */ }
    }
  }
}
