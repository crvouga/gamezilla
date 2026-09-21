/** The hosted checkout: pick an interval, review the order, pay. */

import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { MOCK_BILLING_TEST_IDS } from '../../../public/mock-test-ids';

import type {
  MockBillingPrice,
  MockBillingState,
} from '../shared/mock-billing-contract';
import type { MockBillingApi } from './api';
import { formatDate, formatMoney, isLive, perInterval } from './format';
import { CheckIcon, SparkleIcon } from './icons';
import { PlanOptions } from './plan-options';
import { BackLink, Button, Notice, SecureFootnote, TestModePill } from './ui';

const DAY_MS = 24 * 60 * 60 * 1000;

export type CheckoutScreenProps = {
  readonly state: MockBillingState;
  readonly accountId: string;
  readonly returnUrl: string;
  readonly api: MockBillingApi;
  readonly navigate: (url: string) => void;
  readonly onState: (state: MockBillingState) => void;
};

type PayPhase = 'idle' | 'paying' | 'done';

function SummaryLine(props: {
  readonly label: JSX.Element;
  readonly value: string;
  readonly strong?: boolean;
}) {
  return (
    <div
      class="flex items-baseline justify-between gap-4"
      classList={{
        'pt-3 font-semibold text-base text-zinc-900 dark:text-white':
          props.strong === true,
        'text-sm text-zinc-600 dark:text-zinc-300': props.strong !== true,
      }}
    >
      <dt>{props.label}</dt>
      <dd class="tabular-nums">{props.value}</dd>
    </div>
  );
}

function OrderSummary(props: {
  readonly price: MockBillingPrice;
  readonly productName: string;
  readonly nowMs: number;
}) {
  const trial = () => props.price.trialPeriodDays;
  const amount = () =>
    formatMoney(props.price.unitAmount, props.price.currency);
  const zero = () => formatMoney(0, props.price.currency);
  const firstCharge = () => props.nowMs + trial() * DAY_MS;
  return (
    <div>
      <dl class="divide-y divide-zinc-200/70 dark:divide-zinc-800">
        <div class="space-y-2.5 pb-3">
          <SummaryLine
            label={`${props.productName}, billed ${props.price.interval}ly`}
            value={amount()}
          />
          <Show when={trial() > 0}>
            <SummaryLine
              label={`${String(trial())}-day free trial`}
              value={`−${amount()}`}
            />
          </Show>
        </div>
        <SummaryLine
          label="Due today"
          strong
          value={trial() > 0 ? zero() : amount()}
        />
      </dl>
      <Show when={trial() > 0}>
        <p class="pt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Then {perInterval(props.price)} starting {formatDate(firstCharge())}.
        </p>
      </Show>
    </div>
  );
}

function Hero(props: {
  readonly state: MockBillingState;
  readonly price: MockBillingPrice;
}) {
  const trial = () => props.price.trialPeriodDays;
  return (
    <div class="space-y-3">
      <p class="font-medium text-indigo-600 text-sm dark:text-indigo-400">
        {props.state.brand}
      </p>
      <h1 class="font-semibold text-3xl tracking-tight text-balance sm:text-4xl">
        <Show
          when={trial() > 0}
          fallback={`Subscribe to ${props.state.product.name}`}
        >
          Try {props.state.product.name} free for {trial()} days
        </Show>
      </h1>
      <p class="max-w-md text-base text-zinc-600 text-pretty dark:text-zinc-400">
        {props.state.product.description}
      </p>
    </div>
  );
}

const PERKS = [
  'Cancel anytime from this portal',
  'Switch between monthly and yearly',
  'No commitment during the free trial',
] as const;

function Perks() {
  return (
    <ul class="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
      <For each={PERKS}>
        {(perk) => (
          <li class="flex items-center gap-2.5">
            <span class="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
              <CheckIcon class="size-3" />
            </span>
            {perk}
          </li>
        )}
      </For>
    </ul>
  );
}

function PaymentField(props: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <label class="block">
      <span class="mb-1.5 block font-medium text-xs text-zinc-600 dark:text-zinc-400">
        {props.label}
      </span>
      <input
        class="h-10 w-full cursor-default rounded-lg border-0 bg-zinc-50 px-3 text-sm text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/50 dark:text-zinc-300 dark:ring-zinc-700"
        classList={{ 'font-mono tracking-wide': props.mono === true }}
        readOnly
        value={props.value}
      />
    </label>
  );
}

function PaymentDetails() {
  return (
    <div class="space-y-3">
      <PaymentField label="Card number" mono value="4242 4242 4242 4242" />
      <div class="grid grid-cols-2 gap-3">
        <PaymentField label="Expiry" mono value="12 / 34" />
        <PaymentField label="CVC" mono value="123" />
      </div>
      <PaymentField label="Name on card" value="Test Customer" />
    </div>
  );
}

function PayPanel(props: {
  readonly price: MockBillingPrice;
  readonly phase: PayPhase;
  readonly error: string | null;
  readonly onPay: () => void;
}) {
  const label = () => {
    if (props.phase === 'done') return 'Subscribed — returning…';
    if (props.phase === 'paying') return 'Processing…';
    return props.price.trialPeriodDays > 0 ? 'Start free trial' : 'Subscribe';
  };
  return (
    <div class="space-y-5">
      <div>
        <h2 class="font-semibold text-base">Payment details</h2>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          A test card is on file — nothing is charged.
        </p>
      </div>
      <PaymentDetails />
      <Show when={props.error}>
        {(message) => <Notice tone="danger">{message()}</Notice>}
      </Show>
      <Button
        block
        busy={props.phase === 'paying'}
        disabled={props.phase === 'done'}
        done={props.phase === 'done'}
        onClick={props.onPay}
        size="lg"
        testId={MOCK_BILLING_TEST_IDS.checkoutPay}
      >
        {label()}
      </Button>
      <SecureFootnote>Secured by Mock Billing · test mode</SecureFootnote>
    </div>
  );
}

function AlreadyMember(props: {
  readonly state: MockBillingState;
  readonly returnUrl: string;
}) {
  return (
    <div class="space-y-4 text-center">
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
        <SparkleIcon class="size-6" />
      </span>
      <div>
        <h2 class="font-semibold text-lg">
          You already have {props.state.product.name}
        </h2>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your membership is active. Manage it any time from billing settings.
        </p>
      </div>
      <a
        class="inline-flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 font-semibold text-sm text-white hover:bg-indigo-500"
        href={props.returnUrl}
      >
        Return to app
      </a>
    </div>
  );
}

function useCheckout(props: CheckoutScreenProps) {
  const [selectedKey, setSelectedKey] = createSignal(
    props.state.defaultPriceKey
  );
  const [phase, setPhase] = createSignal<PayPhase>('idle');
  const [error, setError] = createSignal<string | null>(null);
  const price = createMemo(
    () =>
      props.state.prices.find((p) => p.key === selectedKey()) ??
      props.state.prices[0]
  );
  const pay = async () => {
    setPhase('paying');
    setError(null);
    try {
      props.onState(
        await props.api.checkout({
          accountId: props.accountId,
          priceKey: selectedKey(),
        })
      );
      setPhase('done');
      props.navigate(props.returnUrl);
    } catch (cause) {
      setPhase('idle');
      setError(cause instanceof Error ? cause.message : 'Payment failed');
    }
  };
  return { selectedKey, setSelectedKey, phase, error, price, pay };
}

export function CheckoutScreen(props: CheckoutScreenProps) {
  const checkout = useCheckout(props);
  const alreadyMember = () =>
    isLive(props.state.membership) && checkout.phase() === 'idle';
  return (
    <div class="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div class="flex w-full flex-col gap-8 px-5 pt-6 pb-10 sm:px-10 lg:ml-auto lg:max-w-2xl lg:py-12">
        <div class="flex items-center justify-between gap-4">
          <BackLink href={props.returnUrl} label="Back" />
          <TestModePill />
        </div>
        <Show when={checkout.price()}>
          {(price) => (
            <div class="animate-rise space-y-8 lg:my-auto">
              <Hero price={price()} state={props.state} />
              <PlanOptions
                name="plan"
                onSelect={checkout.setSelectedKey}
                prices={props.state.prices}
                selectedKey={checkout.selectedKey()}
              />
              <OrderSummary
                nowMs={props.state.nowMs}
                price={price()}
                productName={props.state.product.name}
              />
              <Perks />
            </div>
          )}
        </Show>
      </div>
      <div class="border-zinc-200 bg-white px-5 py-10 sm:px-10 lg:border-l lg:py-12 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="mx-auto max-w-md lg:sticky lg:top-12 lg:mx-0 lg:mt-24">
          <Show
            when={!alreadyMember()}
            fallback={
              <AlreadyMember returnUrl={props.returnUrl} state={props.state} />
            }
          >
            <Show when={checkout.price()}>
              {(price) => (
                <PayPanel
                  error={checkout.error()}
                  onPay={() => void checkout.pay()}
                  phase={checkout.phase()}
                  price={price()}
                />
              )}
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
