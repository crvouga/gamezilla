/** @jsxImportSource solid-js */
/**
 * The billing screen's body as a function of its view model: no queries, no
 * network, so every tier × membership combination renders in a test.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared/offer';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
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
    <StackVertical gap="2xl" testId={Handles.billingScreen}>
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
      <P variant="caption">
        <Trans>
          Payments are processed securely by our billing provider. We never see
          your card details.
        </Trans>
      </P>
    </StackVertical>
  );
}

export type BillingScreenLayoutProps = BillingScreenViewProps & {
  /** The membership row has not been read yet. */
  readonly loading?: boolean | undefined;
};

/**
 * The billing screen's shell around its body: the Settings breadcrumb, the
 * loading state until the membership row is read, and a whole-body scroll,
 * so the plan, pricing and benefits never clip on a short phone.
 */
export function BillingScreenLayout(
  props: BillingScreenLayoutProps
): JSX.Element {
  return (
    <ContentScreen
      screenId="billing"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Billing</Trans> },
      ]}
    >
      <Show when={props.loading !== true} fallback={<LoadingState size="lg" />}>
        <BillingScreenView
          view={props.view}
          offer={props.offer}
          locale={props.locale}
          formatDate={props.formatDate}
          actions={props.actions}
        />
      </Show>
    </ContentScreen>
  );
}
