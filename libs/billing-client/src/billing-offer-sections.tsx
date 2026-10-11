/** @jsxImportSource solid-js */
/**
 * What the membership costs and what it adds, both read from the offer the
 * provider is reconciled to — never prices typed into the screen.
 *
 * These are settings rows on the billing screen, not a pricing page. The
 * current price is the one chosen row.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
import type { PriceSummary } from './billing-view-model';
import { formatMinorUnits } from './billing-view-model';

function PriceInterval(props: {
  readonly interval: PriceSummary['interval'];
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.interval === 'month'}>
        <Trans>Monthly</Trans>
      </Match>
      <Match when={props.interval === 'year'}>
        <Trans>Yearly</Trans>
      </Match>
    </Switch>
  );
}

function PriceTerms(props: {
  readonly price: PriceSummary;
  readonly perMonth: string;
}): JSX.Element {
  const perMonth = (): string => props.perMonth;
  return (
    <Switch>
      <Match when={props.price.interval === 'month'}>
        <Trans>per month</Trans>
      </Match>
      <Match when={props.price.interval === 'year'}>
        <Trans>per year · {perMonth()}/month</Trans>
      </Match>
    </Switch>
  );
}

function PriceRow(props: {
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
      class="panelItem"
      classList={{ 'bg-tint-active': props.current }}
      data-testid={Handles.billingPrice(props.price.key)}
      aria-current={props.current ? 'true' : undefined}
    >
      <div class="box flex-row items-center gap-3 p-4">
        <div class="box min-w-0 flex-1 gap-1">
          <p
            class="text textLabel"
            classList={{ 'text-on-primary': props.current }}
          >
            <PriceInterval interval={props.price.interval} />
          </p>
          <p
            class="text textCaption"
            classList={{ 'text-on-primary': props.current }}
            data-testid={Handles.billingPriceTerms}
          >
            <PriceTerms price={props.price} perMonth={perMonth()} />
            <Show when={props.price.savingsPercent}>
              {(percent) => (
                <span data-testid={Handles.billingPriceSaving}>
                  {' '}
                  <Trans>Save {percent()}%</Trans>
                </span>
              )}
            </Show>
          </p>
        </div>
        <p
          class="text textBodyBold textNumeral shrink-0"
          classList={{ 'text-on-primary': props.current }}
          data-testid={Handles.billingPriceAmount}
        >
          {amount()}
        </p>
      </div>
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
      <div class="panel">
        <For each={props.prices}>
          {(price) => (
            <PriceRow
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
    <li class="panelItem">
      <p class="text textBody p-4">{props.children}</p>
    </li>
  );
}

export function BillingBenefits(): JSX.Element {
  return (
    <section class="box gap-3" data-testid={Handles.billingBenefits}>
      <h2 class="text textSubtitle">
        <Trans>What Plus includes</Trans>
      </h2>
      <ul class="panel">
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
