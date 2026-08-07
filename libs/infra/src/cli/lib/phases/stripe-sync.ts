import { REPO_ROOT } from '../../paths';
import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { runAsync } from '../../subprocess';
import { withLockDbSuspended } from '../lock-db-session';

/**
 * Runs the `@libs/stripe sync` script: Stripe catalog reconcile.
 */
export async function runStripeSyncPhase(platform: CiPlatform): Promise<void> {
  await withLockDbSuspended(async () => {
    await runStep(platform, 'Stripe sync', async () => {
      await runAsync(
        platform,
        'bun',
        ['run', '--filter', '@libs/stripe', '--elide-lines=0', 'sync'],
        {
          cwd: REPO_ROOT,
          label: 'stripe: catalog reconcile',
        }
      );
    });
  });
}
