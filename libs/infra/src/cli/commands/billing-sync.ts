import { cliClock } from '../lib/cli-io';
import { banner } from '../lib/fmt';
import { runBillingSyncPhase } from '../lib/phases/billing-sync';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI atomic step: reconcile the billing catalog onto the configured vendor.
 */
export class BillingSyncCommand implements Command {
  readonly id = 'billing-sync';
  readonly group = 'phase' as const;
  readonly summary = 'Sync billing catalog (products/prices)';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = cliClock.now();
    banner('Billing sync');
    await runBillingSyncPhase(this.platform);
    banner('Billing sync complete', cliClock.now() - t0);
  }
}
