/** @jsxImportSource solid-js */
/**
 * `/more/billing` — membership and the Unlimited subscription plans.
 * Reads the synced subscription row locally and opens hosted checkout or
 * the billing portal to change it.
 */

import { Trans } from '@lingui/solid/macro';
import { ScreenBase } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { BillingMembershipSection } from './billing-membership-section';
import { BillingPlansSection } from './billing-plans-section';

export function BillingScreen(): JSX.Element {
  return (
    <ScreenBase
      screenId="billing"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Billing</Trans> },
      ]}
      scroll
      content={({ bodyClass }) => (
        <div class={`box ${bodyClass} gap-5`} data-testid="billing-screen">
          <p class="text textBody text-text-secondary">
            <Trans>Get unlimited access to Gamezilla servers.</Trans>
          </p>
          <BillingMembershipSection />
          <BillingPlansSection />
          <p class="text textCaption text-text-secondary">
            <Trans>
              Payments are processed by our billing provider. We never see your
              card.
            </Trans>
          </p>
        </div>
      )}
    />
  );
}
