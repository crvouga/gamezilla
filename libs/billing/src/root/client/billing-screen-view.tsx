/** @jsxImportSource solid-js */
/**
 * The billing screen's body as a function of its view model: no queries, no
 * network, so every tier × membership combination renders in a test.
 */

import { Handles } from '@libs/test-ids';
import { Trans } from '@lingui/solid/macro';
import type { PlusMembershipOffer } from '@pkgs/billing';
import { createMemo, type JSX, Show } from 'solid-js';

import { BillingBenefits, BillingPricing } from './billing-offer-sections';
import { type BillingActions, BillingPlanCard } from './billing-plan-card';
import { type BillingView, summarizeOffer } from './billing-view-model';

export type { BillingActions };

export type BillingScreenViewProps = {
  readonly view: BillingView;
  readonly offer: PlusMembershipOffer;
  readonly locale: string;
  readonly formatDate: (ms: number) => string;
  readonly actions: BillingActions;
};

export function BillingScreenView(props: BillingScreenViewProps): JSX.Element {
  const prices = createMemo(() => summarizeOffer(props.offer));
  const trialDays = (): number =>
    props.offer.prices[props.offer.defaultPriceKey]?.trialPeriodDays ?? 0;
  const productName = (): string => props.offer.portal.businessProfileHeadline;
  return (
    <div
      class="box w-full max-w-160 gap-6 self-center p-4"
      data-testid={Handles.billingScreen}
    >
      <BillingPlanCard
        view={props.view}
        productName={productName()}
        trialDays={trialDays()}
        formatDate={props.formatDate}
        actions={props.actions}
      />
      <Show when={props.view.showPricing}>
        <BillingPricing
          prices={prices()}
          locale={props.locale}
          currentPriceKey={props.view.priceKey}
          trialDays={trialDays()}
        />
        <BillingBenefits productName={productName()} />
      </Show>
      <p class="text textCaption text-center text-text-secondary">
        <Trans>
          Payments are processed securely by our billing provider. We never see
          your card details.
        </Trans>
      </p>
    </div>
  );
}
