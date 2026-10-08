/** @jsxImportSource solid-js */
/**
 * `/more/billing` — the membership screen. Reads everything locally (the
 * synced membership row, the permission system's decisions) so it renders
 * offline, and opens the provider's hosted checkout or portal for anything
 * that changes money. What a denied subscribe unlocks is the permission
 * system's to say.
 */

import { useClientConfig } from '@libs/app-config-client/use-client-config';
import { useCurrentUser } from '@libs/auth-client/use-current-user';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared/plus-membership-offer';
import { useUnlock } from '@libs/permissions-client/unlock';
import { useCan, useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { createTimedValue } from '@pkgs/clock-client/solid';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { useOpenExternalUrl } from '@pkgs/ui-root-client/external-url';
import { type Accessor, createMemo, type JSX } from 'solid-js';
import { BillingScreenLayout } from './billing-screen-view';
import type { BillingView, BillingViewInput } from './billing-view-model';
import { billingViewChangesAtMs, buildBillingView } from './billing-view-model';
import { useManageSubscription } from './use-manage-subscription';
import { useMyMembershipRow } from './use-my-membership-row';
import { useSubscribe } from './use-subscribe';

function useBillingView(subscribe: Accessor<Decision>): Accessor<BillingView> {
  const row = useMyMembershipRow();
  const currentUser = useCurrentUser();
  const { config } = useClientConfig();
  const engine = useSyncEngine();
  const unlock = useUnlock();
  const canView = useCan(PERMISSION.billingView);
  const canManage = useCan(PERMISSION.billingManage);
  const input = createTimedValue(
    (nowMs): BillingViewInput => ({
      canView: canView(),
      canSubscribe: subscribe().allowed,
      canManage: canManage(),
      subscribeUnlockLabel: unlock.label(subscribe()) ?? null,
      hasCustomer: currentUser.billingCustomerId !== null,
      row: row(),
      nowMs,
      graceMs: config().billing_grace_period_ms,
      confirmedAtMs: engine.status().lastSyncedAtMs,
      online: engine.status().online,
    }),
    billingViewChangesAtMs
  );
  return createMemo(() => buildBillingView(input()));
}

export function BillingScreen(): JSX.Element {
  const subscribeDecision = useDecision(PERMISSION.billingSubscribe);
  const view = useBillingView(subscribeDecision);
  const { i18n } = useLinguiRuntime();
  const subscribe = useSubscribe();
  const manage = useManageSubscription();
  const unlock = useUnlock();
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
    <BillingScreenLayout
      view={view()}
      offer={PLUS_MEMBERSHIP_OFFER}
      locale={i18n().locale}
      formatDate={formatDate}
      actions={{
        subscribe: openCheckout,
        manage,
        unlock: () => unlock.run(subscribeDecision()),
      }}
    />
  );
}
