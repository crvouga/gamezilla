import { banner, ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { createDestroyRegistry } from '../resources/registry';
import { fetchDopplerSecret, getSecretMap } from '../secrets/secrets';
import type { Command } from './types';

export class DestroyCommand implements Command {
  readonly id = 'destroy';
  readonly summary = 'Tear down all infrastructure managed by Terraform';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Destroy');

    await runStep(this.platform, 'Secrets', () => this.ensureSecrets());

    const resources = createDestroyRegistry();

    for (const resource of resources) {
      await runStep(this.platform, `Destroy: ${resource.id}`, () =>
        resource.destroy(this.platform)
      );
    }

    banner('Destroy Complete', performance.now() - t0);
    ok('All managed infrastructure has been torn down');
  }

  private ensureSecrets(): void {
    for (const { doppler, env } of getSecretMap()) {
      if (process.env[env]) continue;
      try {
        process.env[env] = fetchDopplerSecret(doppler);
      } catch {
        this.platform.warning(`${env} — not in env and Doppler fetch failed`);
      }
    }
    ok('Secrets loaded');
  }
}
