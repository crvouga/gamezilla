/** The portal's cards: current plan, billing interval, payment method. */
import { For, type JSX, Match, Show, Switch } from 'solid-js';

import { MOCK_BILLING_TEST_IDS } from '../../../public/mock-test-ids';
import type {
  MockBillingMembership,
  MockBillingPrice,
  MockBillingState,
} from '../shared/mock-billing-contract';
import {
  formatDate,
  formatDaysUntil,
  formatMoney,
  intervalLabel,
  monthlyEquivalent,
  perInterval,
  statusMeta,
} from './format';
import { VisaMark } from './icons';
import { SavingsTag } from './plan-options';
import { Badge, Button, Card, Notice } from './ui';

export type PortalBusy = 'cancel' | 'resume' | `switch:${string}` | null;

export function priceOf(
  state: MockBillingState,
  key: string | null
): MockBillingPrice | undefined {
  return state.prices.find((price) => price.key === key);
}

function periodEnd(membership: MockBillingMembership): string {
  return membership.periodEndMs === null
    ? 'the end of the current period'
    : formatDate(membership.periodEndMs);
}

function RenewalLine(props: {
  readonly state: MockBillingState;
  readonly membership: MockBillingMembership;
  readonly price: MockBillingPrice | undefined;
}) {
  const until = () =>
    props.membership.periodEndMs === null
      ? ''
      : ` (${formatDaysUntil(props.membership.periodEndMs, props.state.nowMs)})`;
  const charge = () =>
    props.price === undefined ? '' : ` for ${perInterval(props.price)}`;
  return (
    <p class="text-sm text-zinc-600 dark:text-zinc-400">
      <Switch>
        <Match when={props.membership.endsAtPeriodEnd}>
          Access ends on{' '}
          <strong class="font-medium text-zinc-900 dark:text-zinc-100">
            {periodEnd(props.membership)}
          </strong>
          {until()}. You won't be charged again.
        </Match>
        <Match when={props.membership.status === 'trialing'}>
          Your free trial ends on{' '}
          <strong class="font-medium text-zinc-900 dark:text-zinc-100">
            {periodEnd(props.membership)}
          </strong>
          {until()}. After that, your plan renews{charge()}.
        </Match>
        <Match when={props.membership.status === 'active'}>
          Renews on{' '}
          <strong class="font-medium text-zinc-900 dark:text-zinc-100">
            {periodEnd(props.membership)}
          </strong>
          {charge()}.
        </Match>
      </Switch>
    </p>
  );
}

function PlanNotice(props: {
  readonly membership: MockBillingMembership;
  readonly busy: PortalBusy;
  readonly onResume: () => void;
}) {
  return (
    <Switch>
      <Match when={props.membership.endsAtPeriodEnd}>
        <Notice
          action={
            <Button
              busy={props.busy === 'resume'}
              onClick={props.onResume}
              testId={MOCK_BILLING_TEST_IDS.portalResume}
            >
              Renew plan
            </Button>
          }
          tone="warning"
        >
          Your plan is canceled and ends on{' '}
          <strong class="font-semibold">{periodEnd(props.membership)}</strong>.
          You keep full access until then.
        </Notice>
      </Match>
      <Match when={props.membership.status === 'delinquent'}>
        <Notice tone="danger">
          Your last payment didn't go through. We'll retry automatically — you
          keep access until {periodEnd(props.membership)}.
        </Notice>
      </Match>
      <Match when={props.membership.status === 'incomplete'}>
        <Notice tone="warning">
          Your first payment hasn't completed yet. Access starts once it does.
        </Notice>
      </Match>
    </Switch>
  );
}

export function CurrentPlanCard(props: {
  readonly state: MockBillingState;
  readonly membership: MockBillingMembership;
  readonly busy: PortalBusy;
  readonly onCancel: () => void;
  readonly onResume: () => void;
}) {
  const price = () => priceOf(props.state, props.membership.priceKey);
  const meta = () => statusMeta(props.membership);
  return (
    <Card title="Current plan">
      <div class="space-y-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-semibold text-xl tracking-tight">
                {props.state.product.name}
              </h3>
              <Badge tone={meta().tone}>{meta().label}</Badge>
            </div>
            <RenewalLine
              membership={props.membership}
              price={price()}
              state={props.state}
            />
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
          membership={props.membership}
          onResume={props.onResume}
        />
        <Show when={!props.membership.endsAtPeriodEnd}>
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
  readonly state: MockBillingState;
  readonly price: MockBillingPrice;
  readonly current: boolean;
  readonly disabled: boolean;
  readonly onSwitch: (key: string) => void;
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
        <SavingsTag price={props.price} prices={props.state.prices} />
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
      <Show
        fallback={
          <Button
            block
            disabled={props.disabled}
            onClick={() => props.onSwitch(props.price.key)}
            testId={MOCK_BILLING_TEST_IDS.portalSwitchStart(props.price.key)}
            variant="secondary"
          >
            Switch to {props.price.interval}ly
          </Button>
        }
        when={props.current}
      >
        <span class="flex h-10 items-center justify-center rounded-lg bg-indigo-600/10 font-semibold text-indigo-700 text-sm dark:bg-indigo-400/15 dark:text-indigo-300">
          Current plan
        </span>
      </Show>
    </div>
  );
}

export function IntervalCard(props: {
  readonly state: MockBillingState;
  readonly membership: MockBillingMembership;
  readonly disabled: boolean;
  readonly onSwitch: (key: string) => void;
}) {
  return (
    <Card title="Billing interval">
      <div class="grid gap-3 sm:grid-cols-2">
        <For each={props.state.prices}>
          {(price) => (
            <IntervalOption
              current={price.key === props.membership.priceKey}
              disabled={props.disabled}
              onSwitch={props.onSwitch}
              price={price}
              state={props.state}
            />
          )}
        </For>
      </div>
    </Card>
  );
}

export function PaymentMethodCard(): JSX.Element {
  return (
    <Card title="Payment method">
      <div class="flex items-center gap-4">
        <VisaMark />
        <div class="min-w-0 flex-1">
          <p class="font-medium text-sm">Visa ending in 4242</p>
          <p class="text-sm text-zinc-500 dark:text-zinc-400">
            Expires 12/2034
          </p>
        </div>
        <Badge tone="neutral">Default</Badge>
      </div>
    </Card>
  );
}
