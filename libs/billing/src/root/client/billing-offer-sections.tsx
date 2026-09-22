/** @jsxImportSource solid-js */
/**
 * What the membership costs and what it adds, both read from the offer the
 * provider is reconciled to — never prices typed into the screen.
 */

import { Handles } from '@libs/test-ids';
import { Trans } from '@lingui/solid/macro';
import { Badge, CheckIcon } from '@pkgs/ui';
import { For, type JSX, Match, Show, Switch } from 'solid-js';

import { formatMinorUnits, type PriceSummary } from './billing-view-model';

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
      class="box min-w-0 flex-1 gap-1 rounded-xl border p-4"
      classList={{
        'border-tint bg-tint-subtle': props.current,
        'border-border bg-surface': !props.current,
      }}
      data-testid={Handles.billingPrice(props.price.key)}
    >
      <div class="box flex-row items-center justify-between gap-2">
        <p class="text textLabel text-text-secondary">
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
              label={<Trans>Save {percent()}%</Trans>}
            />
          )}
        </Show>
      </div>
      <p class="text textHeading">{amount()}</p>
      <p class="text textCaption text-text-secondary">
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
      <p class="text textSubtitle">
        <Trans>Pricing</Trans>
      </p>
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
        <p class="text textCaption text-text-secondary">
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
      <div class="box h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-surface">
        <CheckIcon size={14} color="success" />
      </div>
      <p class="text textBody flex-1">{props.children}</p>
    </li>
  );
}

export function BillingBenefits(props: {
  readonly productName: string;
}): JSX.Element {
  return (
    <section
      class="box gap-4 rounded-2xl border border-border bg-surface p-5"
      data-testid={Handles.billingBenefits}
    >
      <p class="text textSubtitle">
        <Trans>What {props.productName} includes</Trans>
      </p>
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
