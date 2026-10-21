import { CustomerLinks } from '@libs/billing-shared/customer-links';
import { membershipRecheckDue } from '@libs/billing-shared/membership-recheck';
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import { createLogger } from '@pkgs/logger-shared/logger';
import type { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';

import { projectMembershipChange } from './apply-membership-change';

/**
 * Asks the provider about a membership again once its re-check falls due,
 * through the same reading a callback gets, and projects what it says. A
 * provider that cannot be reached fails the delivery so the outbox retries
 * it; one no longer configured cannot be asked, so the re-check ends there.
 */
export function registerMembershipRecheck(
  registry: OutboxConsumerRegistry,
  providers: MembershipProviders | null
): void {
  registry.register({
    id: 'billing-membership-recheck',
    on: membershipRecheckDue,
    handler: async (ctx, payload) => {
      const provider = providers?.byId.get(payload.provider);
      if (provider === undefined) return;
      const change = await provider.readMembership(payload.subscriptionId);
      if (change === null || change.provider !== provider.provider) return;
      const accountId = await new CustomerLinks(ctx.tx).accountOf(
        change.provider,
        change.customerId
      );
      if (accountId === null) return;
      const applied = await projectMembershipChange({
        tx: ctx.tx,
        clock: ctx.clock,
        accountId,
        change,
      });
      createLogger({
        name: 'billing',
        now: () => ctx.clock.now(),
      }).info('billing membership rechecked', {
        provider: change.provider,
        status: change.membership.status,
        projected: applied,
      });
      return applied ? { notifyUserIds: [accountId] } : undefined;
    },
  });
}
