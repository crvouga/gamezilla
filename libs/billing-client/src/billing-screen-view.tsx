/** @jsxImportSource solid-js */
/**
 * The billing screen's body as a function of its view model: no queries, no
 * network, so every tier × membership combination renders in a test.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared/offer';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { createMemo, type JSX, Show } from 'solid-js';

import { BillingBenefits, BillingPricing } from './billing-offer-sections';
import type { BillingActions } from './billing-plan-actions';
import { BillingPlanCard } from './billing-plan-card';
import type { BillingView } from './billing-view-model';
import { formatMinorUnits, summarizeOffer } from './billing-view-model';

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
  const creditAmount = (): string | null => {
    if (props.view.creditCents <= 0) return null;
    const currency =
      props.offer.prices[props.offer.defaultPriceKey]?.currency ?? 'usd';
    return formatMinorUnits(props.view.creditCents, currency, props.locale);
  };
  return (
    <div
      class="box w-full max-w-160 gap-8 py-2"
      data-testid={Handles.billingScreen}
    >
      <BillingPlanCard
        view={props.view}
        trialDays={trialDays()}
        formatDate={props.formatDate}
        actions={props.actions}
        creditAmount={creditAmount()}
      />
      <Show when={props.view.showPricing}>
        <BillingPricing
          prices={prices()}
          locale={props.locale}
          currentPriceKey={props.view.priceKey}
          trialDays={trialDays()}
        />
        <BillingBenefits />
      </Show>
      <p class="text textCaption">
        <Trans>
          Payments are processed securely by our billing provider. We never see
          your card details.
        </Trans>
      </p>
    </div>
  );
}

/**
 * The billing screen's shell around its body: the Settings breadcrumb and a
 * whole-body scroll, so the plan, pricing and benefits never clip on a short
 * phone.
 */
export function BillingScreenLayout(
  props: BillingScreenViewProps
): JSX.Element {
  return (
    <ContentScreen
      screenId="billing"
      surface="canvas"
      breadcrumbs={[
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Billing</Trans> },
      ]}
    >
      <BillingScreenView {...props} />
    </ContentScreen>
  );
}
