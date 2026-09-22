/**
 * The hosted checkout for one session: pick a plan (the session's price or an
 * upsell), pick a test card, pay. Success hands the person to the session's
 * `success_url`; "Back" is its `cancel_url`.
 */
import type { MockTestPaymentMethod } from '@pkgs/billing-mock/wire';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';

import { MOCK_BILLING_BRAND } from '../../src/shared/brand';
import type { CheckoutView, PagePrice } from '../../src/shared/pages';
import { MOCK_BILLING_TEST_IDS } from '../../src/shared/test-ids';
import { type MockBillingPageApi, messageOf } from './api';
import { CardChooser, DEFAULT_TEST_CARD } from './card-chooser';
import { formatDate, formatMoney, perInterval } from './format';
import { CheckIcon } from './icons';
import { PlanOptions } from './plan-options';
import { BackLink, Button, Notice, SecureFootnote, TestModePill } from './ui';

const DAY_MS = 24 * 60 * 60 * 1000;

export type CheckoutScreenProps = {
  readonly view: CheckoutView;
  readonly api: MockBillingPageApi;
  readonly navigate: (url: string) => void;
};

type PayPhase = 'idle' | 'paying' | 'done';

function trialDays(view: CheckoutView): number {
  return view.session.trialPeriodDays ?? 0;
}

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
  readonly view: CheckoutView;
  readonly price: PagePrice;
}) {
  const trial = () => trialDays(props.view);
  const amount = () =>
    formatMoney(props.price.unitAmount, props.price.currency);
  const zero = () => formatMoney(0, props.price.currency);
  const firstCharge = () => props.view.nowMs + trial() * DAY_MS;
  return (
    <div>
      <dl class="divide-y divide-zinc-200/70 dark:divide-zinc-800">
        <div class="space-y-2.5 pb-3">
          <SummaryLine
            label={`${props.view.business.product.name}, billed ${props.price.interval}ly`}
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

function Hero(props: { readonly view: CheckoutView }) {
  const name = () => props.view.business.product.name;
  return (
    <div class="space-y-3">
      <p class="font-medium text-indigo-600 text-sm dark:text-indigo-400">
        {props.view.business.name}
      </p>
      <h1 class="font-semibold text-3xl tracking-tight text-balance sm:text-4xl">
        <Show
          fallback={`Subscribe to ${name()}`}
          when={trialDays(props.view) > 0}
        >
          Try {name()} free for {trialDays(props.view)} days
        </Show>
      </h1>
      <p class="max-w-md text-base text-zinc-600 text-pretty dark:text-zinc-400">
        {props.view.business.product.description}
      </p>
    </div>
  );
}

function perksOf(view: CheckoutView): readonly string[] {
  return [
    'Cancel anytime from the billing portal',
    ...(view.prices.length > 1 ? ['Switch between monthly and yearly'] : []),
    ...(trialDays(view) > 0
      ? ['Nothing is charged until the free trial ends']
      : []),
  ];
}

function Perks(props: { readonly view: CheckoutView }) {
  return (
    <ul class="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
      <For each={perksOf(props.view)}>
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

function payLabel(phase: PayPhase, trial: number): string {
  if (phase === 'done') return 'Subscribed — returning…';
  if (phase === 'paying') return 'Processing…';
  return trial > 0 ? 'Start free trial' : 'Subscribe';
}

function PayPanel(props: {
  readonly view: CheckoutView;
  readonly checkout: Checkout;
}) {
  const trial = () => trialDays(props.view);
  return (
    <div class="space-y-5">
      <div>
        <h2 class="font-semibold text-base">Payment details</h2>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          <Show
            fallback="Pick a test card — nothing is really charged."
            when={trial() > 0}
          >
            Pick a test card. It's saved for when the trial ends — nothing is
            really charged.
          </Show>
        </p>
      </div>
      <CardChooser
        name="card"
        onSelect={props.checkout.setCard}
        selected={props.checkout.card()}
      />
      <Show when={props.checkout.error()}>
        {(message) => (
          <Notice testId={MOCK_BILLING_TEST_IDS.checkoutError} tone="danger">
            {message()}
          </Notice>
        )}
      </Show>
      <Button
        block
        busy={props.checkout.phase() === 'paying'}
        disabled={props.checkout.phase() === 'done'}
        done={props.checkout.phase() === 'done'}
        onClick={() => void props.checkout.pay(props.checkout.card())}
        size="lg"
        testId={MOCK_BILLING_TEST_IDS.checkoutPay}
      >
        {payLabel(props.checkout.phase(), trial())}
      </Button>
      <Show when={props.view.session.cardOptional}>
        <Button
          block
          disabled={props.checkout.phase() !== 'idle'}
          onClick={() => void props.checkout.pay(null)}
          testId={MOCK_BILLING_TEST_IDS.checkoutSkipCard}
          variant="ghost"
        >
          Start trial without a card
        </Button>
      </Show>
      <SecureFootnote>
        Secured by {MOCK_BILLING_BRAND.name} · test mode
      </SecureFootnote>
    </div>
  );
}

function useCheckout(props: CheckoutScreenProps) {
  const [priceId, setPriceId] = createSignal(props.view.selectedPriceId);
  const [card, setCard] =
    createSignal<MockTestPaymentMethod>(DEFAULT_TEST_CARD);
  const [phase, setPhase] = createSignal<PayPhase>('idle');
  const [error, setError] = createSignal<string | null>(null);
  const price = createMemo(
    () =>
      props.view.prices.find((p) => p.id === priceId()) ?? props.view.prices[0]
  );
  const pay = async (paymentMethod: MockTestPaymentMethod | null) => {
    setPhase('paying');
    setError(null);
    try {
      const result = await props.api.confirmCheckout(props.view.session.id, {
        price: priceId(),
        paymentMethod,
      });
      setPhase('done');
      props.navigate(result.redirectUrl);
    } catch (cause) {
      setPhase('idle');
      setError(messageOf(cause, 'Payment failed'));
    }
  };
  return { priceId, setPriceId, card, setCard, phase, error, price, pay };
}

type Checkout = ReturnType<typeof useCheckout>;

function Complete(props: { readonly view: CheckoutView }) {
  return (
    <div class="space-y-4 text-center">
      <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
        <CheckIcon class="size-6" />
      </span>
      <div>
        <h2 class="font-semibold text-lg">This checkout is already complete</h2>
        <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          The payment went through. Head back to finish up.
        </p>
      </div>
      <a
        class="inline-flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 font-semibold text-sm text-white hover:bg-indigo-500"
        href={props.view.session.successUrl}
      >
        Continue
      </a>
    </div>
  );
}

export function CheckoutScreen(props: CheckoutScreenProps) {
  const checkout = useCheckout(props);
  return (
    <div class="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div class="flex w-full flex-col gap-8 px-5 pt-6 pb-10 sm:px-10 lg:ml-auto lg:max-w-2xl lg:py-12">
        <div class="flex items-center justify-between gap-4">
          <BackLink
            href={props.view.session.cancelUrl}
            label="Back"
            testId={MOCK_BILLING_TEST_IDS.checkoutCancel}
          />
          <TestModePill />
        </div>
        <Show when={checkout.price()}>
          {(price) => (
            <div class="animate-rise space-y-8 lg:my-auto">
              <Hero view={props.view} />
              <Show when={props.view.prices.length > 1}>
                <PlanOptions
                  name="plan"
                  onSelect={checkout.setPriceId}
                  prices={props.view.prices}
                  selectedId={checkout.priceId()}
                />
              </Show>
              <OrderSummary price={price()} view={props.view} />
              <Perks view={props.view} />
            </div>
          )}
        </Show>
      </div>
      <div class="border-zinc-200 bg-white px-5 py-10 sm:px-10 lg:border-l lg:py-12 dark:border-zinc-800 dark:bg-zinc-900">
        <div class="mx-auto max-w-md lg:sticky lg:top-12 lg:mx-0 lg:mt-24">
          <Show
            fallback={<Complete view={props.view} />}
            when={props.view.session.status === 'open'}
          >
            <PayPanel checkout={checkout} view={props.view} />
          </Show>
        </div>
      </div>
    </div>
  );
}
