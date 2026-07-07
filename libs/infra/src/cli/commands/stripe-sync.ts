import { banner } from '../lib/fmt';
import { runStripeSyncPhase } from '../lib/phases/stripe-sync';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI atomic step 4: runs `bun run --filter @libs/stripe sync` to
 * reconcile the Stripe catalog, backfill PatchDB, and refresh webhook
 * endpoints (writes `STRIPE_WEBHOOK_SECRET` back to the secret store). Must run
 * after the API worker is deployed so the webhook URL exists.
 */
export class StripeSyncCommand implements Command {
  readonly id = 'stripe-sync';
  readonly group = 'phase' as const;
  readonly summary =
    'Sync Stripe catalog/webhooks + secret store webhook secret';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Stripe sync');
    await runStripeSyncPhase(this.platform);
    banner('Stripe sync complete', performance.now() - t0);
  }
}
