import { heading, info, ok, warn } from '../lib/fmt';
import { TF_DEPLOY_VAR_ARGS } from '../lib/tf-vars';
import { TF_PACKAGE_ROOT } from '../paths';
import type { CiPlatform } from '../platform/platform';
import { run } from '../subprocess';
import { runSafe } from '../subprocess';
import type { Resource } from './types';

export class TerraformResource implements Resource {
  readonly id = 'terraform';

  async destroy(platform: CiPlatform): Promise<void> {
    run(platform, 'terraform', ['init', '-input=false'], {
      cwd: TF_PACKAGE_ROOT,
      label: 'Terraform init',
    });

    const result = runSafe(
      'terraform',
      [
        'destroy',
        '-auto-approve',
        '-input=false',
        '-lock-timeout=120s',
        ...TF_DEPLOY_VAR_ARGS,
      ],
      { cwd: TF_PACKAGE_ROOT }
    );

    if (result.exitCode === 0) {
      ok('Terraform destroy', 'all resources deleted');
    } else {
      const output = (result.stderr || result.stdout).trim();
      warn('Terraform destroy', `exit ${result.exitCode} — some resources could not be API-deleted`);
      if (output) {
        for (const line of output.split('\n')) {
          info('terraform', line);
        }
      }
      this.abandonRemainingState(platform);
    }
  }

  /**
   * After a failed destroy, terraform already API-deleted what it could.
   * Resources still in state are ones the provider refuses to delete.
   * Remove them from state so it's clean.
   */
  private abandonRemainingState(platform: CiPlatform): void {
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
        platform.warning(`State rm failed for ${addr}`);
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
}
