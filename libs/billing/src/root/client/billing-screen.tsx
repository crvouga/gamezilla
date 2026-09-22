/** @jsxImportSource solid-js */
/**
 * `/more/billing` — the membership screen. Reads everything locally (plan
 * role, the synced membership row, the billing switch) so it renders offline,
 * and opens the provider's hosted checkout or portal for anything that
 * changes money.
 */

import { useSignInModal } from '@libs/auth/public/auth-modals-provider';
import { useCurrentUser } from '@libs/auth/public/use-current-user';
import { useClientConfig } from '@libs/client-config/public/use-client-config';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { useCan } from '@libs/permissions/public/use-can';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans } from '@lingui/solid/macro';
import { useClock } from '@pkgs/clock/solid';
import { ScreenBase, useOpenExternalUrl } from '@pkgs/ui';
import { type Accessor, createMemo, type JSX } from 'solid-js';

import { PLUS_MEMBERSHIP_OFFER } from '../../shared/offer/plus-membership-offer';
import { useMyMembershipRow } from '../../use-cases/load-my-subscription/client/use-my-membership-row';
import { useManageSubscription } from '../../use-cases/open-portal-session/client/use-manage-subscription';
import { BillingScreenView } from './billing-screen-view';
import { type BillingView, buildBillingView } from './billing-view-model';
import { useBillingTier } from './use-billing-tier';
import { useSubscribe } from './use-subscribe';

function useBillingView(): Accessor<BillingView> {
  const tier = useBillingTier();
  const row = useMyMembershipRow();
  const currentUser = useCurrentUser();
  const { config } = useClientConfig();
  const clock = useClock();
  const canSubscribe = useCan(PERMISSION.billingSubscribe);
  const canManage = useCan(PERMISSION.billingManage);
  return createMemo(() =>
    buildBillingView({
      tier: tier(),
      billingEnabled: config().billing_enabled,
      canSubscribe: canSubscribe(),
      canManage: canManage(),
      hasCustomer: currentUser.billingCustomerId !== null,
      row: row(),
      nowMs: clock.now(),
    })
  );
}

export function BillingScreen(): JSX.Element {
  const view = useBillingView();
  const { i18n } = useLinguiRuntime();
  const subscribe = useSubscribe();
  const manage = useManageSubscription();
  const signIn = useSignInModal();
  const openExternalUrl = useOpenExternalUrl();
  const formatDate = (ms: number): string =>
    new Intl.DateTimeFormat(i18n().locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(ms));

  const openCheckout = async (): Promise<void> => {
    const url = await subscribe({
      returnUrl: `${window.location.origin}${PLUS_MEMBERSHIP_OFFER.portal.defaultReturnUrlPath}`,
    });
    await openExternalUrl(url);
  };

  return (
    <ScreenBase
      screenId="billing"
      surface="canvas"
      breadcrumbs={[
        { name: <Trans>More</Trans>, href: '/more' },
        { name: <Trans>Billing</Trans> },
      ]}
      content={() => (
        <BillingScreenView
          view={view()}
          offer={PLUS_MEMBERSHIP_OFFER}
          locale={i18n().locale}
          formatDate={formatDate}
          actions={{
            subscribe: openCheckout,
            manage,
            signIn: signIn.open,
          }}
        />
      )}
    />
  );
}
