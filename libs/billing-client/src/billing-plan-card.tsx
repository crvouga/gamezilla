/** @jsxImportSource solid-js */
/**
 * The plan the person is on: tier, status, any notice, and the one action
 * that moves the membership forward. A settings panel, not a marketing hero.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import type { BadgeIntent } from '@pkgs/ui-root-client/badge';
import { Badge } from '@pkgs/ui-root-client/badge';
import { Notice } from '@pkgs/ui-root-client/notice';
import { type JSX, Match, Show, Switch } from 'solid-js';

import type { BillingActions } from './billing-plan-actions';
import { BillingPlanActions } from './billing-plan-actions';
import { BillingStatusLine } from './billing-status-line';
import type { BillingTier, BillingView } from './billing-view-model';

type PlanCardProps = {
  readonly view: BillingView;
  readonly trialDays: number;
  readonly formatDate: (ms: number) => string;
  readonly actions: BillingActions;
  /** Formatted Plus credit, or `null` when there is none to show. */
  readonly creditAmount: string | null;
};

const TIER_INTENT: Record<BillingTier, BadgeIntent> = {
  free: 'info',
  paid: 'brand',
};

/**
 * The tier as a chip. Its text is the tier id itself (`free` / `paid`,
 * capitalized by CSS) — the value harnesses and tests read back.
 */
function TierChip(props: { readonly tier: BillingTier }): JSX.Element {
  return (
    <Badge
      intent={TIER_INTENT[props.tier]}
      tone={props.tier === 'paid' ? 'solid' : 'subtle'}
      dataSet={{ testid: Handles.billingTier }}
      label={<span class="capitalize">{props.tier}</span>}
    />
  );
}

function PlanTitle(props: { readonly tier: BillingTier }): JSX.Element {
  return (
    <Switch>
      <Match when={props.tier === 'paid'}>
        <Trans>Plus</Trans>
      </Match>
      <Match when={props.tier === 'free'}>
        <Trans>Free plan</Trans>
      </Match>
    </Switch>
  );
}

/** Plus credit the provider will spend before the card, when any is left. */
function CreditLine(props: {
  readonly cents: number;
  readonly amount: string;
}): JSX.Element {
  const amount = (): string => props.amount;
  return (
    <p
      class="text textBody text-text-secondary"
      data-testid={Handles.billingCredit}
      data-credit-cents={String(props.cents)}
    >
      <Trans>Plus credit · {amount()} left from your yearly plan</Trans>
    </p>
  );
}

function PlanNotice(props: { readonly view: BillingView }): JSX.Element {
  return (
    <Show when={props.view.notice}>
      {(notice) => (
        <Notice
          tone={notice() === 'delinquent' ? 'error' : 'info'}
          dataSet={{ testid: Handles.billingNotice, notice: notice() }}
        >
          <Switch>
            <Match when={notice() === 'offline'}>
              <Trans>
                Subscribing needs a connection. Connect to the internet to start
                your membership.
              </Trans>
            </Match>
            <Match when={notice() === 'delinquent'}>
              <Trans>
                Your last payment didn't go through. Update your payment method
                to keep your membership.
              </Trans>
            </Match>
            <Match when={notice() === 'incomplete'}>
              <Trans>
                Your checkout hasn't finished. Complete it to start your
                membership.
              </Trans>
            </Match>
            <Match when={notice() === 'unavailable'}>
              <Trans>Memberships aren't available right now.</Trans>
            </Match>
            <Match when={notice() === 'confirming'}>
              <Trans>
                Confirming your payment… Your membership shows here as soon as
                the payment provider confirms it.
              </Trans>
            </Match>
            <Match when={notice() === 'unconfirmed'}>
              <Trans>
                Your payment isn't confirmed yet, but it may have gone through.
                Check again before paying again.
              </Trans>
            </Match>
          </Switch>
        </Notice>
      )}
    </Show>
  );
}

export function BillingPlanCard(props: PlanCardProps): JSX.Element {
  return (
    <section class="panel gap-4 p-5">
      {/* Until the membership is known, no plan is named: "Free plan" for a
          member would be wrong, and so would the checkout it implies. */}
      <Show when={props.view.state !== 'loading'}>
        <div class="box flex-row items-start gap-3">
          <h2 class="text textHeading min-w-0 flex-1">
            <PlanTitle tier={props.view.tier} />
          </h2>
          <TierChip tier={props.view.tier} />
        </div>
      </Show>
      <BillingStatusLine view={props.view} formatDate={props.formatDate} />
      <Show when={props.creditAmount}>
        {(amount) => (
          <CreditLine cents={props.view.creditCents} amount={amount()} />
        )}
      </Show>
      <PlanNotice view={props.view} />
      <BillingPlanActions
        view={props.view}
        trialDays={props.trialDays}
        actions={props.actions}
      />
    </section>
  );
}
