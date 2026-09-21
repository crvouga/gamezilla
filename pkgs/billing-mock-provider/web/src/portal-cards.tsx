/** The portal's plan cards: current plan and billing interval. */
import { For, Match, Show, Switch } from 'solid-js';

import type {
  PagePrice,
  PortalSubscription,
  PortalView,
} from '../../src/shared/pages';
import { MOCK_BILLING_TEST_IDS } from '../../src/shared/test-ids';
import {
  formatDate,
  formatDaysUntil,
  formatMoney,
  intervalLabel,
  isLive,
  monthlyEquivalent,
  perInterval,
  priceKeyOf,
  statusMeta,
} from './format';
import { SavingsTag } from './plan-options';
import { Badge, Button, Card, Notice } from './ui';

/** Which portal action is in flight (`switch:<price id>` for a switch). */
export type PortalBusy =
  | 'cancel'
  | 'renew'
  | 'payment'
  | `switch:${string}`
  | null;

export function priceOf(
  view: PortalView,
  id: string | null
): PagePrice | undefined {
  return view.prices.find((price) => price.id === id);
}

function Strong(props: { readonly children: string }) {
  return (
    <strong class="font-medium text-zinc-900 dark:text-zinc-100">
      {props.children}
    </strong>
  );
}

function RenewalLine(props: {
  readonly view: PortalView;
  readonly subscription: PortalSubscription;
}) {
  const end = () => formatDate(props.subscription.currentPeriodEndMs);
  const until = () =>
    ` (${formatDaysUntil(props.subscription.currentPeriodEndMs, props.view.nowMs)})`;
  const price = () => priceOf(props.view, props.subscription.priceId);
  const charge = () => {
    const p = price();
    return p === undefined ? '' : ` for ${perInterval(p)}`;
  };
  return (
    <p class="text-sm text-zinc-600 dark:text-zinc-400">
      <Switch>
        <Match when={props.subscription.cancelAtPeriodEnd}>
          Access ends on <Strong>{end()}</Strong>
          {until()}. You won't be charged again.
        </Match>
        <Match when={props.subscription.status === 'trialing'}>
          Your free trial ends on <Strong>{end()}</Strong>
          {until()}. After that, your plan renews{charge()}.
        </Match>
        <Match when={props.subscription.status === 'active'}>
          Renews on <Strong>{end()}</Strong>
          {charge()}.
        </Match>
        <Match when={props.subscription.status === 'past_due'}>
          Current period ends on <Strong>{end()}</Strong>.
        </Match>
      </Switch>
    </p>
  );
}

function OpenInvoiceNotice(props: {
  readonly subscription: PortalSubscription;
  readonly busy: PortalBusy;
  readonly onPay: () => void;
}) {
  const retry = () => {
    const next = props.subscription.openInvoice?.nextAttemptMs ?? null;
    return next === null ? '' : ` We'll retry on ${formatDate(next)}.`;
  };
  return (
    <Notice
      action={
        <Button
          busy={props.busy === 'payment'}
          onClick={props.onPay}
          testId={MOCK_BILLING_TEST_IDS.portalPayInvoice}
        >
          Update payment method
        </Button>
      }
      tone="danger"
    >
      <Show
        fallback="Your last payment didn't go through."
        when={props.subscription.openInvoice}
      >
        {(invoice) => (
          <>
            Your payment of{' '}
            <strong class="font-semibold">
              {formatMoney(invoice().amountDue, invoice().currency)}
            </strong>{' '}
            didn't go through.
          </>
        )}
      </Show>
      {retry()} Update your card to pay it now.
    </Notice>
  );
}

function PlanNotice(props: {
  readonly subscription: PortalSubscription;
  readonly busy: PortalBusy;
  readonly onRenew: () => void;
  readonly onPay: () => void;
}) {
  return (
    <Switch>
      <Match
        when={
          props.subscription.cancelAtPeriodEnd && isLive(props.subscription)
        }
      >
        <Notice
          action={
            <Button
              busy={props.busy === 'renew'}
              onClick={props.onRenew}
              testId={MOCK_BILLING_TEST_IDS.portalRenew}
            >
              Renew plan
            </Button>
          }
          tone="warning"
        >
          Your plan is canceled and ends on{' '}
          <strong class="font-semibold">
            {formatDate(props.subscription.currentPeriodEndMs)}
          </strong>
          . You keep full access until then.
        </Notice>
      </Match>
      <Match
        when={
          props.subscription.status === 'past_due' ||
          props.subscription.status === 'unpaid'
        }
      >
        <OpenInvoiceNotice
          busy={props.busy}
          onPay={props.onPay}
          subscription={props.subscription}
        />
      </Match>
      <Match when={props.subscription.status === 'incomplete'}>
        <Notice tone="warning">
          Your first payment hasn't completed yet. Access starts once it does.
        </Notice>
      </Match>
    </Switch>
  );
}

export function CurrentPlanCard(props: {
  readonly view: PortalView;
  readonly subscription: PortalSubscription;
  readonly busy: PortalBusy;
  readonly onCancel: () => void;
  readonly onRenew: () => void;
  readonly onPay: () => void;
}) {
  const price = () => priceOf(props.view, props.subscription.priceId);
  const meta = () => statusMeta(props.subscription);
  return (
    <Card title="Current plan">
      <div class="space-y-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-semibold text-xl tracking-tight">
                {props.view.business.product.name}
              </h3>
              <Badge tone={meta().tone}>{meta().label}</Badge>
            </div>
            <RenewalLine subscription={props.subscription} view={props.view} />
          </div>
          <Show when={price()}>
            {(p) => (
              <p class="shrink-0 sm:text-right">
                <span class="font-semibold text-2xl tabular-nums tracking-tight">
                  {formatMoney(p().unitAmount, p().currency)}
                </span>
                <span class="text-sm text-zinc-500 dark:text-zinc-400">
                  {' '}
                  / {p().interval}
                </span>
              </p>
            )}
          </Show>
        </div>
        <PlanNotice
          busy={props.busy}
          onPay={props.onPay}
          onRenew={props.onRenew}
          subscription={props.subscription}
        />
        <Show when={!props.subscription.cancelAtPeriodEnd}>
          <div class="flex justify-end border-zinc-100 border-t pt-4 dark:border-zinc-800">
            <Button
              onClick={props.onCancel}
              testId={MOCK_BILLING_TEST_IDS.portalCancelStart}
              variant="ghost"
            >
              Cancel plan
            </Button>
          </div>
        </Show>
      </div>
    </Card>
  );
}

function IntervalOption(props: {
  readonly view: PortalView;
  readonly price: PagePrice;
  readonly current: boolean;
  readonly canSwitch: boolean;
  readonly disabled: boolean;
  readonly onSwitch: (price: PagePrice) => void;
}) {
  return (
    <div
      class="flex flex-col gap-3 rounded-xl p-4 ring-1 transition-colors"
      classList={{
        'bg-indigo-50/60 ring-2 ring-indigo-600 dark:bg-indigo-500/10 dark:ring-indigo-400':
          props.current,
        'ring-zinc-200 dark:ring-zinc-700': !props.current,
      }}
    >
      <div class="flex items-center justify-between gap-2">
        <span class="font-semibold text-sm">{intervalLabel(props.price)}</span>
        <SavingsTag price={props.price} prices={props.view.prices} />
      </div>
      <div>
        <span class="font-semibold text-2xl tabular-nums tracking-tight">
          {formatMoney(props.price.unitAmount, props.price.currency)}
        </span>
        <span class="text-sm text-zinc-500 dark:text-zinc-400">
          {' '}
          / {props.price.interval}
        </span>
        <p class="mt-0.5 min-h-4 text-xs text-zinc-500 dark:text-zinc-400">
          {monthlyEquivalent(props.price) ?? 'Billed every month'}
        </p>
      </div>
      <Switch>
        <Match when={props.current}>
          <span class="flex h-10 items-center justify-center rounded-lg bg-indigo-600/10 font-semibold text-indigo-700 text-sm dark:bg-indigo-400/15 dark:text-indigo-300">
            Current plan
          </span>
        </Match>
        <Match when={props.canSwitch}>
          <Button
            block
            disabled={props.disabled}
            onClick={() => props.onSwitch(props.price)}
            testId={MOCK_BILLING_TEST_IDS.portalSwitchStart(
              priceKeyOf(props.price)
            )}
            variant="secondary"
          >
            Switch to {props.price.interval}ly
          </Button>
        </Match>
      </Switch>
    </div>
  );
}

export function IntervalCard(props: {
  readonly view: PortalView;
  readonly subscription: PortalSubscription;
  readonly disabled: boolean;
  readonly onSwitch: (price: PagePrice) => void;
}) {
  const canSwitch = () =>
    isLive(props.subscription) && !props.subscription.cancelAtPeriodEnd;
  return (
    <Card title="Billing interval">
      <div class="space-y-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <For each={props.view.prices}>
            {(price) => (
              <IntervalOption
                canSwitch={canSwitch()}
                current={price.id === props.subscription.priceId}
                disabled={props.disabled}
                onSwitch={props.onSwitch}
                price={price}
                view={props.view}
              />
            )}
          </For>
        </div>
        <Show when={props.subscription.cancelAtPeriodEnd}>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            Renew your plan to change how often you're billed.
          </p>
        </Show>
      </div>
    </Card>
  );
}
