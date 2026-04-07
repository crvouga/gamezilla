import { createDeployRegistry } from '../lib/deploy-registry';
import { readTfOutputs } from '../lib/tf-outputs';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import type { Command } from './types';

export class DeployAppsCommand implements Command {
  readonly id = 'ci-deploy-apps';
  readonly summary = 'Build + deploy web app to Cloudflare Pages';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const outputs = readTfOutputs(this.platform);
    const registry = createDeployRegistry(this.platform);

    for (const deployable of registry) {
      await runStep(this.platform, `Deploy: ${deployable.id}`, () =>
        deployable.deploy(outputs)
      );
    }
  }
}
