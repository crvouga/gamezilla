/** @jsxImportSource solid-js */
/**
 * What the membership costs and what it adds, both read from the offer the
 * provider is reconciled to — never prices typed into the screen.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client/badge';
import { CheckIcon } from '@pkgs/ui-root-client/icons';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
import type { PriceSummary } from './billing-view-model';
import { formatMinorUnits } from './billing-view-model';

function PriceTile(props: {
  readonly price: PriceSummary;
  readonly locale: string;
  /** The membership is on this price. */
  readonly current: boolean;
}): JSX.Element {
  const amount = (): string =>
    formatMinorUnits(
      props.price.unitAmount,
      props.price.currency,
      props.locale
    );
  const perMonth = (): string =>
    formatMinorUnits(
      props.price.perMonthAmount,
      props.price.currency,
      props.locale
    );
  return (
    <div
      class="box min-w-0 flex-1 gap-1 rounded-card border p-4"
      classList={{
        'border-tint-active bg-tint-subtle': props.current,
        'border-border bg-surface': !props.current,
      }}
      data-testid={Handles.billingPrice(props.price.key)}
      aria-current={props.current ? 'true' : undefined}
    >
      <div class="box flex-row items-center justify-between gap-2">
        <p class="text textLabel">
          <Switch>
            <Match when={props.price.interval === 'month'}>
              <Trans>Monthly</Trans>
            </Match>
            <Match when={props.price.interval === 'year'}>
              <Trans>Yearly</Trans>
            </Match>
          </Switch>
        </p>
        <Show when={props.price.savingsPercent}>
          {(percent) => (
            <Badge
              size="sm"
              intent="success"
              dataSet={{ testid: Handles.billingPriceSaving }}
              label={<Trans>Save {percent()}%</Trans>}
            />
          )}
        </Show>
      </div>
      <p
        class="text textHeading textNumeral"
        data-testid={Handles.billingPriceAmount}
      >
        {amount()}
      </p>
      <p class="text textCaption" data-testid={Handles.billingPriceTerms}>
        <Switch>
          <Match when={props.price.interval === 'month'}>
            <Trans>per month</Trans>
          </Match>
          <Match when={props.price.interval === 'year'}>
            <Trans>per year · {perMonth()}/month</Trans>
          </Match>
        </Switch>
      </p>
    </div>
  );
}

export function BillingPricing(props: {
  readonly prices: readonly PriceSummary[];
  readonly locale: string;
  readonly currentPriceKey: string | null;
  readonly trialDays: number;
}): JSX.Element {
  return (
    <section class="box gap-3" data-testid={Handles.billingPricing}>
      <h2 class="text textSubtitle">
        <Trans>Pricing</Trans>
      </h2>
      <div class="box flex-row flex-wrap gap-3">
        <For each={props.prices}>
          {(price) => (
            <PriceTile
              price={price}
              locale={props.locale}
              current={price.key === props.currentPriceKey}
            />
          )}
        </For>
      </div>
      <Show when={props.trialDays > 0}>
        <p class="text textCaption">
          <Trans>
            Every plan starts with a {props.trialDays}-day free trial. Switch
            between monthly and yearly or cancel anytime.
          </Trans>
        </p>
      </Show>
    </section>
  );
}

function Benefit(props: { readonly children: JSX.Element }): JSX.Element {
  return (
    <li class="box flex-row items-start gap-3">
      <div class="box h-6 w-5 shrink-0 items-center justify-center">
        <CheckIcon size={18} color="tint" />
      </div>
      <p class="text textBody flex-1">{props.children}</p>
    </li>
  );
}

export function BillingBenefits(): JSX.Element {
  return (
    <section class="box gap-3" data-testid={Handles.billingBenefits}>
      <h2 class="text textSubtitle">
        <Trans>What Plus includes</Trans>
      </h2>
      <ul class="box gap-3">
        <Benefit>
          <Trans>Unlimited access to Gamezilla servers</Trans>
        </Benefit>
        <Benefit>
          <Trans>Host as many spaces as you like at once</Trans>
        </Benefit>
        <Benefit>
          <Trans>Everything in the free plan, synced across your devices</Trans>
        </Benefit>
        <Benefit>
          <Trans>Manage or cancel anytime from the billing portal</Trans>
        </Benefit>
      </ul>
    </section>
  );
}
