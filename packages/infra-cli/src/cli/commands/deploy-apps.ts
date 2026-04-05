import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { runStep } from '../platform';
import { ensureAwsEnvCredentials } from '../lib/aws-creds';
import { readTfOutputs } from '../lib/tf-outputs';
import { createDeployRegistry } from '../lib/deploy-registry';

export class DeployAppsCommand implements Command {
  readonly id = 'deploy-apps';
  readonly summary = 'Deploy apps from terraform outputs';
  readonly group = 'ci' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    ensureAwsEnvCredentials();
    const outputs = readTfOutputs(this.platform);
    const registry = createDeployRegistry(this.platform);

    for (let i = 0; i < registry.length; i++) {
      const d = registry[i]!;
      await runStep(
        this.platform,
        `Deploy app ${i + 1}/${registry.length} — ${d.id}`,
        () => d.deploy(outputs),
      );
    }
  }
}
