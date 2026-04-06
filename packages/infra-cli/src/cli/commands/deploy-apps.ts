import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { runStep } from '../platform';
import { readTfOutputs } from '../lib/tf-outputs';
import { createDeployRegistry } from '../lib/deploy-registry';

export class DeployAppsCommand implements Command {
  readonly id = 'deploy-apps';
  readonly summary = 'Build + deploy web app to Cloudflare Pages';
  readonly group = 'ci' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const outputs = readTfOutputs(this.platform);
    const registry = createDeployRegistry(this.platform);

    for (const deployable of registry) {
      await runStep(this.platform, `Deploy: ${deployable.id}`, () =>
        deployable.deploy(outputs),
      );
    }
  }
}
