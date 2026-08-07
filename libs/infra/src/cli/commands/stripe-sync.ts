import { banner } from '../lib/fmt';
import { runStripeSyncPhase } from '../lib/phases/stripe-sync';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI atomic step: runs `bun run --filter @libs/stripe sync` to reconcile the
 * Stripe catalog (Products/Prices). Entity_store dump is paused until Stripe
 * rewires onto `@pkgs/entity-store`.
 */
export class StripeSyncCommand implements Command {
  readonly id = 'stripe-sync';
  readonly group = 'phase' as const;
  readonly summary = 'Sync Stripe catalog (Products/Prices)';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Stripe sync');
    await runStripeSyncPhase(this.platform);
    banner('Stripe sync complete', performance.now() - t0);
  }
}
