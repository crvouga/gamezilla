/** @jsxImportSource solid-js */

import { useIsSignedIn } from '@libs/auth/public/use-current-user';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useClock } from '@pkgs/clock/solid';
import { Button, MenuSection, useMutationButton } from '@pkgs/ui';
import { type Accessor, createMemo, For, type JSX, Show } from 'solid-js';

import {
  CATALOG_PRICE_KEYS,
  CATALOG_SPEC,
  type CatalogPriceKey,
} from '../../shared/catalog/catalog-spec';
import {
  formatUsdCents,
  subscriptionEntitled,
} from '../../shared/membership/subscription-entitled';
import { useMySubscription } from '../../use-cases/load-my-subscription/client/use-my-subscription';
import { useBillingHttp } from './use-billing-http';

function intervalLabel(priceKey: CatalogPriceKey): 'month' | 'year' {
  return CATALOG_SPEC.prices[priceKey].recurring.interval;
}

function PlanPrice(props: { priceKey: CatalogPriceKey }): JSX.Element {
  const { t } = useLingui();
  const amount = formatUsdCents(CATALOG_SPEC.prices[props.priceKey].unitAmount);
  const days =
    CATALOG_SPEC.prices[props.priceKey].recurring.trialPeriodDays ?? 0;
  return (
    <div class="box gap-1">
      <p class="text textBodyBold text-text">
        <Show
          when={intervalLabel(props.priceKey) === 'year'}
          fallback={<>{t`${amount} / month`}</>}
        >
          {t`${amount} / year`}
        </Show>
      </p>
      <Show when={days > 0}>
        <p class="text textCaption text-text-secondary">
          {t`${days}-day free trial`}
        </p>
      </Show>
    </div>
  );
}

function SubscribeButton(props: { priceKey: CatalogPriceKey }): JSX.Element {
  const { t } = useLingui();
  const billing = useBillingHttp();
  const subscribe = useMutationButton({
    operation: () => billing.subscribe(props.priceKey),
    labels: {
      get idle() {
        return t`Subscribe`;
      },
      get loading() {
        return t`Opening checkout…`;
      },
      get success() {
        return t`Redirecting`;
      },
      get error() {
        return t`Couldn't start checkout`;
      },
    },
    successHoldMs: 0,
  });
  return (
    <Button
      {...subscribe.buttonProps}
      intent="primary"
      dataSet={{ testid: `billing-subscribe-${props.priceKey}` }}
    />
  );
}

function SubscriptionPlan(props: {
  priceKey: CatalogPriceKey;
  current: Accessor<boolean>;
  canSubscribe: Accessor<boolean>;
}): JSX.Element {
  const { t } = useLingui();
  const name =
    props.priceKey === 'subscription_yearly' ? t`Yearly` : t`Monthly`;
  return (
    <div class="box gap-3 p-3" data-testid={`billing-plan-${props.priceKey}`}>
      <div class="box gap-1">
        <p class="text textBodyBold text-text">{name}</p>
        <PlanPrice priceKey={props.priceKey} />
        <Show when={props.current()}>
          <p class="text textCaption text-text-secondary">{t`Current plan`}</p>
        </Show>
      </div>
      <Show when={props.canSubscribe()}>
        <SubscribeButton priceKey={props.priceKey} />
      </Show>
    </div>
  );
}

export function BillingPlansSection(): JSX.Element {
  const signedIn = useIsSignedIn();
  const row = useMySubscription();
  const clock = useClock();
  const entitled = createMemo(() => subscriptionEntitled(row(), clock.now()));
  const canSubscribe = createMemo(() => signedIn() && !entitled());
  return (
    <MenuSection
      title={<Trans>Subscriptions</Trans>}
      dataSet={{ testid: 'billing-subscriptions' }}
    >
      <Show when={!signedIn()}>
        <p class="text textCaption text-text-secondary p-3">
          <Trans>Sign in to subscribe.</Trans>
        </p>
      </Show>
      <For each={CATALOG_PRICE_KEYS}>
        {(priceKey) => (
          <SubscriptionPlan
            priceKey={priceKey}
            current={() => entitled() && row()?.price_key === priceKey}
            canSubscribe={canSubscribe}
          />
        )}
      </For>
    </MenuSection>
  );
}
