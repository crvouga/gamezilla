import { createInterface } from 'node:readline/promises';
import { banner, fmt, ok } from '../lib/fmt';
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
    banner('Destroy');

    this.ensureSecrets();

    if (!process.env['CI']) {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        console.log('');
        console.log(
          fmt.red(fmt.bold('  This will destroy ALL managed infrastructure.'))
        );
        console.log('');
        const answer = await rl.question(
          `  ${fmt.yellow('Type "destroy" to confirm:')} `
        );
        if (answer.trim() !== 'destroy') {
          console.log('');
          ok('Aborted', 'no changes made');
          return;
        }
      } finally {
        rl.close();
      }
    }

    const resources = createDestroyRegistry();

    for (const resource of resources) {
      await runStep(this.platform, `Destroy: ${resource.id}`, () =>
        resource.destroy(this.platform)
      );
    }

    banner('Destroy Complete');
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
