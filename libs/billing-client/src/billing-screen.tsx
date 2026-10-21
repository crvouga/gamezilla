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
import { useHostingInvite } from '@libs/spaces-client/hosting-invite';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import {
  CHECKOUT_RETURN_PARAM,
  isPaidCheckoutReturn,
} from '@pkgs/billing-root-shared/checkout-return';
import { createTimedValue, useClock } from '@pkgs/clock-client/solid';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import {
  useLocalSearchParams,
  usePathname,
  useRouter,
} from '@pkgs/ui-root-client/app-router';
import { useOpenExternalUrl } from '@pkgs/ui-root-client/external-url';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  untrack,
} from 'solid-js';
import { BillingScreenLayout } from './billing-screen-view';
import type { BillingView, BillingViewInput } from './billing-view-model';
import { billingViewChangesAtMs, buildBillingView } from './billing-view-model';
import { type CheckoutReturn, useCheckoutReturn } from './checkout-return';
import { openCheckout } from './open-checkout';
import { useManageSubscription } from './use-manage-subscription';
import { useMyMembershipRow } from './use-my-membership-row';
import { useSubscribe } from './use-subscribe';

function useBillingView(
  subscribe: Accessor<Decision>,
  checkoutReturn: CheckoutReturn
): Accessor<BillingView> {
  const membership = useMyMembershipRow();
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
      row: membership.row(),
      nowMs,
      graceMs: config().billing_grace_period_ms,
      confirmedAtMs: engine.status().lastSyncedAtMs,
      online: engine.status().online,
      loading: membership.loading(),
      checkoutReturnedAtMs: checkoutReturn.returnedAtMs(),
    }),
    billingViewChangesAtMs
  );
  return createMemo(() => buildBillingView(input()));
}

/**
 * Remember a paid return from checkout (its mark in the address) for the
 * session, and forget it once the new membership shows.
 */
function useCheckoutReturnTracking(): CheckoutReturn {
  const checkoutReturn = useCheckoutReturn();
  const params = useLocalSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const clock = useClock();
  createEffect(() => {
    if (!isPaidCheckoutReturn(params()[CHECKOUT_RETURN_PARAM])) return;
    if (untrack(checkoutReturn.returnedAtMs) === null) {
      checkoutReturn.mark(clock.now());
    }
    // Opening this address again later (a reload, a saved tab) is not a
    // return from paying.
    router.replace(untrack(pathname));
  });
  return checkoutReturn;
}

export function BillingScreen(): JSX.Element {
  const subscribeDecision = useDecision(PERMISSION.billingSubscribe);
  const checkoutReturn = useCheckoutReturnTracking();
  const view = useBillingView(subscribeDecision, checkoutReturn);
  const { i18n } = useLinguiRuntime();
  const subscribe = useSubscribe();
  const manage = useManageSubscription();
  const unlock = useUnlock();
  const openExternalUrl = useOpenExternalUrl();
  const invite = useHostingInvite();
  const engine = useSyncEngine();
  const clock = useClock();
  const [awaitingPlus, setAwaitingPlus] = createSignal(false);
  // Checkout answers a hosting invitation. Confirming an existing membership
  // after a connection returns does not.
  createEffect(() => {
    if (!awaitingPlus() || view().tier !== 'paid') return;
    invite.clear();
    setAwaitingPlus(false);
  });
  // The paid checkout's membership has shown: nothing is waiting any more.
  createEffect(() => {
    const state = view().state;
    if (checkoutReturn.returnedAtMs() === null) return;
    if (state === 'loading' || state === 'none' || state === 'ended') return;
    checkoutReturn.clear();
  });
  const formatDate = (ms: number): string =>
    new Intl.DateTimeFormat(i18n().locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(ms));

  const startCheckout = (): Promise<void> =>
    openCheckout({
      setAwaiting: setAwaitingPlus,
      start: () =>
        subscribe({
          returnUrl: `${window.location.origin}${PLUS_MEMBERSHIP_OFFER.portal.defaultReturnUrlPath}`,
        }),
      open: openExternalUrl,
      refresh: () => void engine.refreshQueries(),
    });

  const checkAgain = (): void => {
    checkoutReturn.mark(clock.now());
    void engine.refreshQueries();
  };

  return (
    <BillingScreenLayout
      view={view()}
      offer={PLUS_MEMBERSHIP_OFFER}
      locale={i18n().locale}
      formatDate={formatDate}
      actions={{
        subscribe: startCheckout,
        manage,
        unlock: () => unlock.run(subscribeDecision()),
        checkAgain,
      }}
    />
  );
}
