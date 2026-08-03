import { banner } from '../lib/fmt';
import { runStripeSyncPhase } from '../lib/phases/stripe-sync';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI atomic step: runs `bun run --filter @libs/stripe sync` to reconcile the
 * Stripe catalog and backfill entity_store tables. Must run after the API
 * worker is deployed when catalog consumers need a live API, but sync itself
 * only needs Stripe API + Postgres.
 */
export class StripeSyncCommand implements Command {
  readonly id = 'stripe-sync';
  readonly group = 'phase' as const;
  readonly summary = 'Sync Stripe catalog + entity_store backfill';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Stripe sync');
    await runStripeSyncPhase(this.platform);
    banner('Stripe sync complete', performance.now() - t0);
  }
}
