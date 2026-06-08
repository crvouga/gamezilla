import { withLockDbSuspended } from '../lock-db-session';
import { REPO_ROOT } from '../../paths';
import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { runAsync } from '../../subprocess';

/**
 * Runs the `@libs/stripe sync` script: catalog + patch-db backfill +
 * webhook endpoints, with `STRIPE_WEBHOOK_SECRET` written back to Vault.
 * Must run after API worker is deployed so the webhook endpoint URL exists.
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
          env: process.env,
          label:
            'stripe: catalog + patch-db backfill + webhook endpoints (+ Vault STRIPE_WEBHOOK_SECRET)',
        }
      );
    });
  });
}
