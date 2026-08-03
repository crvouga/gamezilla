import { withLockDbSuspended } from '../lock-db-session';
import { REPO_ROOT } from '../../paths';
import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { runAsync } from '../../subprocess';

/**
 * Runs the `@libs/stripe sync` script: catalog + entity_store backfill.
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
          label: 'stripe: catalog + entity_store backfill',
        }
      );
    });
  });
}
