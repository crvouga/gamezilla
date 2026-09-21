/**
 * The hosted customer portal for one session: see the plan, switch interval,
 * cancel or renew, update the card, read invoices. Like a real provider's
 * portal it cannot start a subscription — that is the app's checkout.
 */
import { type JSX, Match, Show, Switch } from 'solid-js';

import { MOCK_BILLING_BRAND } from '../../src/shared/brand';
import type { PortalSubscription, PortalView } from '../../src/shared/pages';
import { MOCK_BILLING_TEST_IDS } from '../../src/shared/test-ids';
import type { MockBillingPageApi } from './api';
import { formatDate, isLive } from './format';
import { CheckIcon, CloseIcon } from './icons';
import { InvoiceHistoryCard, PaymentMethodCard } from './portal-billing-cards';
import { CurrentPlanCard, IntervalCard } from './portal-cards';
import {
  CancelDialog,
  PaymentMethodDialog,
  SwitchDialog,
} from './portal-dialogs';
import { type Portal, usePortal } from './portal-state';
import { BackLink, Card, Notice, TestModePill } from './ui';

export type PortalScreenProps = {
  readonly sessionId: string;
  readonly view: PortalView;
  readonly api: MockBillingPageApi;
  readonly onView: (view: PortalView) => void;
};

function Flash(props: {
  readonly message: string;
  readonly onDismiss: () => void;
}) {
  return (
    <div
      aria-live="polite"
      class="flex animate-pop items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900"
      data-testid={MOCK_BILLING_TEST_IDS.portalNotice}
      role="status"
    >
      <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <CheckIcon class="size-3" />
      </span>
      <span class="flex-1">{props.message}</span>
      <button
        aria-label="Dismiss"
        class="rounded-md p-1 opacity-70 hover:opacity-100"
        onClick={() => props.onDismiss()}
        type="button"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function NoSubscription(props: { readonly view: PortalView }) {
  return (
    <Card>
      <div class="flex flex-col items-center gap-2 py-6 text-center">
        <h2 class="font-semibold text-lg">No subscriptions</h2>
        <p class="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          There's nothing to manage here yet. To subscribe to{' '}
          {props.view.business.product.name}, go back to the app and start from
          there.
        </p>
      </div>
    </Card>
  );
}

function EndedSubscription(props: {
  readonly view: PortalView;
  readonly subscription: PortalSubscription;
}) {
  const ended = () =>
    props.subscription.endedAtMs ?? props.subscription.currentPeriodEndMs;
  return (
    <Card title="Current plan">
      <div class="space-y-1.5">
        <h3 class="font-semibold text-xl tracking-tight">
          {props.view.business.product.name}
        </h3>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          Your plan ended on {formatDate(ended())}. To subscribe again, go back
          to the app.
        </p>
      </div>
    </Card>
  );
}

function PortalHeader(props: { readonly view: PortalView }) {
  return (
    <header class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <BackLink
          href={props.view.returnUrl}
          label="Return to app"
          testId={MOCK_BILLING_TEST_IDS.portalReturn}
        />
        <TestModePill />
      </div>
      <div class="space-y-1">
        <p class="font-medium text-indigo-600 text-sm dark:text-indigo-400">
          {props.view.business.name}
        </p>
        <h1 class="font-semibold text-3xl tracking-tight">
          Manage {props.view.business.product.name}
        </h1>
      </div>
    </header>
  );
}

function LivePlan(props: {
  readonly portal: Portal;
  readonly view: PortalView;
  readonly subscription: PortalSubscription;
}): JSX.Element {
  return (
    <>
      <CurrentPlanCard
        busy={props.portal.busy()}
        onCancel={() => props.portal.open({ kind: 'cancel' })}
        onPay={() => props.portal.open({ kind: 'payment' })}
        onRenew={() =>
          void props.portal.run({ kind: 'renew' }, 'Your plan was renewed.')
        }
        subscription={props.subscription}
        view={props.view}
      />
      <IntervalCard
        disabled={props.portal.busy() !== null}
        onSwitch={(price) => props.portal.open({ kind: 'switch', price })}
        subscription={props.subscription}
        view={props.view}
      />
      <CancelDialog
        portal={props.portal}
        subscription={props.subscription}
        view={props.view}
      />
      <SwitchDialog portal={props.portal} subscription={props.subscription} />
    </>
  );
}

function Plan(props: { readonly portal: Portal; readonly view: PortalView }) {
  return (
    <Switch fallback={<NoSubscription view={props.view} />}>
      <Match
        when={
          isLive(props.view.subscription) ? props.view.subscription : undefined
        }
      >
        {(subscription) => (
          <LivePlan
            portal={props.portal}
            subscription={subscription()}
            view={props.view}
          />
        )}
      </Match>
      <Match when={props.view.subscription}>
        {(subscription) => (
          <EndedSubscription subscription={subscription()} view={props.view} />
        )}
      </Match>
    </Switch>
  );
}

export function PortalScreen(props: PortalScreenProps) {
  const portal = usePortal({
    sessionId: props.sessionId,
    api: props.api,
    onView: (view) => props.onView(view),
  });
  return (
    <div class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-5 pt-6 pb-12 sm:px-8 sm:pt-10">
      <PortalHeader view={props.view} />
      <Show when={portal.flash()}>
        {(message) => (
          <Flash message={message()} onDismiss={() => portal.setFlash(null)} />
        )}
      </Show>
      <Show when={portal.error() !== null && portal.pending() === null}>
        <Notice testId={MOCK_BILLING_TEST_IDS.portalError} tone="danger">
          {portal.error()}
        </Notice>
      </Show>
      <Plan portal={portal} view={props.view} />
      <PaymentMethodCard
        card={props.view.paymentMethod}
        disabled={portal.busy() !== null}
        onUpdate={() => portal.open({ kind: 'payment' })}
      />
      <InvoiceHistoryCard view={props.view} />
      <PaymentMethodDialog
        hasOpenInvoice={(props.view.subscription?.openInvoice ?? null) !== null}
        portal={portal}
      />
      <footer class="mt-auto pt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        {MOCK_BILLING_BRAND.footer}
      </footer>
    </div>
  );
}
