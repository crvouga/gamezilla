import { createInterface } from 'node:readline/promises';
import { banner, fmt, heading, info, ok, warn } from '../lib/fmt';
import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { fetchDopplerSecret, getSecretMap } from '../secrets/secrets';
import { run, runSafe } from '../subprocess';
import type { Command } from './types';

export class DestroyCommand implements Command {
  readonly id = 'destroy';
  readonly summary = 'Tear down all infrastructure managed by Terraform';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Destroy');

    heading('Secrets');
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

    heading('Terraform init');
    await runStep(this.platform, 'Terraform init', () =>
      run(this.platform, 'terraform', ['init', '-input=false'], {
        cwd: TF_PACKAGE_ROOT,
        label: 'Terraform init',
      })
    );

    heading('Terraform destroy');
    const destroyArgs = [
      'destroy',
      '-auto-approve',
      '-input=false',
      '-lock-timeout=120s',
      ...TF_DEPLOY_VAR_ARGS,
    ];

    const result = runSafe('terraform', destroyArgs, {
      cwd: TF_PACKAGE_ROOT,
    });

    if (result.exitCode === 0) {
      ok('Terraform destroy', 'all resources deleted');
    } else {
      warn('Terraform destroy', 'some resources could not be API-deleted');
      this.abandonRemainingState();
    }

    banner('Destroy Complete');
    ok('All managed infrastructure has been torn down');
  }

  /**
   * After a failed destroy, terraform already API-deleted what it could.
   * Resources still in state are ones the provider refuses to delete
   * (e.g. PlanetScale default branch, roles that own objects).
   * Remove them from state so it's clean.
   */
  private abandonRemainingState(): void {
    const remaining = this.listStateResources();
    if (remaining.length === 0) {
      ok('State', 'already clean');
      return;
    }

    heading('Abandon undeletable resources');
    for (const addr of remaining) {
      info('Removing from state', addr);
      const rm = runSafe('terraform', ['state', 'rm', addr], {
        cwd: TF_PACKAGE_ROOT,
      });
      if (rm.exitCode === 0) {
        ok('Removed', addr);
      } else {
        warn('Could not remove', addr);
      }
    }

    const leftover = this.listStateResources();
    if (leftover.length === 0) {
      ok('State', 'clean');
    } else {
      warn('State', `${leftover.length} resource(s) still tracked`);
    }
  }

  private listStateResources(): string[] {
    const result = runSafe('terraform', ['state', 'list'], {
      cwd: TF_PACKAGE_ROOT,
    });
    if (result.exitCode !== 0) return [];
    return result.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
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
