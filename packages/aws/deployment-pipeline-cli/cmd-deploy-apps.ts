import assert from 'node:assert/strict';
import { BasePipelineCommand } from './base-command';
import { readCdkOutputs } from './cdk-outputs';
import { reportNotice } from './ci-platform';
import { DEPLOY_REGISTRY } from './deploy-registry';

export class DeployAppsCommand extends BasePipelineCommand {
  readonly id = 'deploy-apps';
  readonly summary = 'Read CDK outputs → deploy all registered apps';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const outputs = readCdkOutputs();

    for (const d of DEPLOY_REGISTRY) {
      reportNotice(`Deploying ${d.id}…`);
      d.deploy(outputs);
    }
  }
}
