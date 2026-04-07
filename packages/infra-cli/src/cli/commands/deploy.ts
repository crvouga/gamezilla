import { banner, heading, ok } from '../lib/fmt';
import { readTfOutputs, requireOutput } from '../lib/tf-outputs';
import type { CiPlatform } from '../platform/platform';
import { loadSecretsIntoEnv } from '../secrets/secrets';
import { ApplyCommand } from './apply';
import { DeployAppsCommand } from './deploy-apps';
import { runHttpSmokeTestsOnly } from './post-deploy';
import type { Command } from './types';

export class DeployCommand implements Command {
  readonly id = 'deploy';
  readonly summary = 'Full deploy: terraform + workers + pages + smoke tests';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Deploy');

    heading('Load secrets');
    loadSecretsIntoEnv();

    heading('Terraform apply');

    const tfVarOverrides = ['-var', 'custom_domain=true'] as const;

    const applyCmd = new ApplyCommand(this.platform, { tfVarOverrides });
    await applyCmd.execute();

    const deployAppsCmd = new DeployAppsCommand(this.platform);
    await deployAppsCmd.execute();

    const outputs = readTfOutputs(this.platform);

    await runHttpSmokeTestsOnly(this.platform, outputs);

    banner('Deploy Complete');
    for (const key of ['web_app_url', 'api_url'] as const) {
      try {
        ok(key, requireOutput(this.platform, outputs, key));
      } catch {
        /* output not available */
      }
    }
  }
}
