import { REPO_ROOT } from '../../paths';
import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { runAsync } from '../../subprocess';
import { withLockDbSuspended } from '../lock-db-session';

/**
 * Runs the billing catalog sync script (vendor adapter via composition root).
 */
export async function runBillingSyncPhase(platform: CiPlatform): Promise<void> {
  await withLockDbSuspended(async () => {
    await runStep(platform, 'Billing sync', async () => {
      await runAsync(
        platform,
        'bun',
        ['run', '--filter', '@apps/server', '--elide-lines=0', 'billing:sync'],
        {
          cwd: REPO_ROOT,
          label: 'billing: catalog reconcile',
        }
      );
    });
  });
}
