import { assert } from '@gamezilla/shared/assert';
import { BasePipelineCommand } from './base-command';
import { readTfOutputs } from './tf-outputs';
import { runStep } from './ci-platform';
import { createDeployRegistry } from './deploy-registry';

export class DeployAppsCommand extends BasePipelineCommand {
  readonly id = 'deploy-apps';
  readonly summary = 'Read Terraform outputs → deploy all registered apps';

  async execute(argv: string[]): Promise<void> {
    assert.array(argv, 'execute: argv must be an array');
    const outputs = readTfOutputs(this.platform);
    const registry = createDeployRegistry(this.platform);

    for (let i = 0; i < registry.length; i++) {
      const d = registry[i]!;
      await runStep(
        this.platform,
        `Deploy app ${i + 1}/${registry.length} — ${d.id}`,
        () => d.deploy(outputs)
      );
    }
  }
}
