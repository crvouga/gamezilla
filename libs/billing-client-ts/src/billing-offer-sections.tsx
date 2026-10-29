/** @jsxImportSource solid-js */
/**
 * What the membership costs and what it adds, both read from the offer the
 * provider is reconciled to — never prices typed into the screen.
 *
 * These are settings rows on the billing screen, not a pricing page. The
 * current price is the one chosen row.
 */

import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Text } from '@pkgs/ui-root-client-ts/text';
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
    <MenuRow
      title={<PriceInterval interval={props.price.interval} />}
      caption={
        <Text variant="inherit" testId={Handles.billingPriceTerms}>
          <PriceTerms price={props.price} perMonth={perMonth()} />
          <Show when={props.price.savingsPercent}>
            {(percent) => (
              <Text
                variant="inherit"
                tone="success"
                testId={Handles.billingPriceSaving}
              >
                {' '}
                <Trans>Save {percent()}%</Trans>
              </Text>
            )}
          </Show>
        </Text>
      }
      trailing={
        <Text variant="bodyBold" numeral testId={Handles.billingPriceAmount}>
          {amount()}
        </Text>
      }
      selected={props.current}
      current={props.current}
      dataSet={{ testid: Handles.billingPrice(props.price.key) }}
    />
  );
}

export function BillingPricing(props: {
  readonly prices: readonly PriceSummary[];
  readonly locale: string;
  readonly currentPriceKey: string | null;
  readonly trialDays: number;
}): JSX.Element {
  return (
    <MenuSection
      title={<Trans>Pricing</Trans>}
      role="group"
      footer={
        props.trialDays > 0 ? (
          <Trans>
            Every plan starts with a {props.trialDays}-day free trial. Switch
            between monthly and yearly or cancel anytime.
          </Trans>
        ) : undefined
      }
      dataSet={{ testid: Handles.billingPricing }}
    >
      <For each={props.prices}>
        {(price) => (
          <PriceRow
            price={price}
            locale={props.locale}
            current={price.key === props.currentPriceKey}
          />
        )}
      </For>
    </MenuSection>
  );
}

export function BillingBenefits(): JSX.Element {
  const productName = PRODUCT_NAME;
  return (
    <MenuSection
      title={<Trans>What Plus includes</Trans>}
      role="group"
      dataSet={{ testid: Handles.billingBenefits }}
    >
      <MenuRow
        title={<Trans>Unlimited access to {productName} servers</Trans>}
      />
      <MenuRow title={<Trans>Host as many spaces as you like at once</Trans>} />
      <MenuRow
        title={
          <Trans>Everything in the free plan, synced across your devices</Trans>
        }
      />
      <MenuRow
        title={<Trans>Manage or cancel anytime from the billing portal</Trans>}
      />
    </MenuSection>
  );
}
