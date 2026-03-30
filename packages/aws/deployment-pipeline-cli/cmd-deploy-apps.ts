import { assert } from '@gamezilla/shared/assert';
import { BasePipelineCommand } from './base-command';
import { readCdkOutputs } from './cdk-outputs';
import { createDeployRegistry } from './deploy-registry';

export class DeployAppsCommand extends BasePipelineCommand {
  readonly id = 'deploy-apps';
  readonly summary = 'Read CDK outputs → deploy all registered apps';

  execute(argv: string[]): void {
    assert.array(argv, 'execute: argv must be an array');
    const outputs = readCdkOutputs(this.platform);

    for (const d of createDeployRegistry(this.platform)) {
      this.platform.notice(`Deploying ${d.id}…`);
      d.deploy(outputs);
    }
  }
}
