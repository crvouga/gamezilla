/** @jsxImportSource solid-js */
/**
 * The billing screen as a function of its view model: no queries, no
 * network, so every tier × membership combination renders in a test and a
 * story.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared-ts/offer';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, Show } from 'solid-js';

import { BillingBenefits, BillingPricing } from './billing-offer-sections';
import type { BillingActions } from './billing-plan-actions';
import { BillingPlanCard } from './billing-plan-card';
import type { BillingView } from './billing-view-model';
import { formatMinorUnits, summarizeOffer } from './billing-view-model';

export type BillingScreenViewProps = {
  /** What to show, from `buildBillingView`. */
  readonly view: BillingView;
  readonly offer: PlusMembershipOffer;
  /** Locale for prices and credit. */
  readonly locale: string;
  /** Formats a membership date for the status line. */
  readonly formatDate: (ms: number) => string;
  /** Subscribe and manage return promises: their buttons show progress. */
  readonly actions: BillingActions;
};

/** The billing screen's body: plan card, then the offer's prices and benefits. */
export function BillingScreenBody(props: BillingScreenViewProps): JSX.Element {
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

/**
 * `/more/billing`, presentational: the Settings breadcrumb and a whole-body
 * scroll around the plan, pricing and benefits, so they never clip on a short
 * phone. Every membership state is a `BillingView`; `BillingScreen` builds it
 * from the synced membership row and the permission system's decisions.
 */
export function BillingScreenView(props: BillingScreenViewProps): JSX.Element {
  return (
    <ContentScreen
      screenId="billing"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Billing</Trans> },
      ]}
    >
      <BillingScreenBody
        view={props.view}
        offer={props.offer}
        locale={props.locale}
        formatDate={props.formatDate}
        actions={props.actions}
      />
    </ContentScreen>
  );
}
