/** @jsxImportSource solid-js */
/**
 * The billing screen's hero: the plan the person is on, its tier chip, where
 * the membership stands, any notice about it, and the one action that moves
 * it forward.
 */

import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  Badge,
  type BadgeIntent,
  Button,
  CreditCardIcon,
  KeyRoundIcon,
  Notice,
  useMutationButton,
} from '@pkgs/ui';
import { type JSX, Match, Show, Switch } from 'solid-js';

import type { BillingTier, BillingView } from './billing-view-model';

export type BillingActions = {
  readonly subscribe: () => Promise<void>;
  readonly manage: () => Promise<void>;
  /** Runs the subscribe denial's unlock (the permission system's CTA). */
  readonly unlock: () => void;
};

type PlanCardProps = {
  readonly view: BillingView;
  readonly productName: string;
  readonly trialDays: number;
  readonly formatDate: (ms: number) => string;
  readonly actions: BillingActions;
};

const TIER_INTENT: Record<BillingTier, BadgeIntent> = {
  free: 'info',
  paid: 'brand',
};

/**
 * The tier as a chip. Its text is the tier id itself (`free` / `paid`,
 * capitalized by CSS) — the value sims and tests read back.
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

function PlanTitle(props: {
  readonly tier: BillingTier;
  readonly productName: string;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.tier === 'paid'}>{props.productName}</Match>
      <Match when={props.tier === 'free'}>
        <Trans>Free plan</Trans>
      </Match>
    </Switch>
  );
}

/** One line on where the membership stands, with its date. */
function StatusLine(props: {
  readonly view: BillingView;
  readonly formatDate: (ms: number) => string;
}): JSX.Element {
  const date = (): string =>
    props.view.periodEndMs === null
      ? ''
      : props.formatDate(props.view.periodEndMs);
  const days = (): number => props.view.daysLeft ?? 0;
  return (
    <p
      class="text textBody text-text-secondary"
      data-testid={Handles.billingStatus}
      data-state={props.view.state}
      data-period-end={
        props.view.periodEndMs === null
          ? undefined
          : new Date(props.view.periodEndMs).toISOString()
      }
    >
      <Switch>
        <Match when={props.view.state === 'trialing'}>
          <Trans>
            Free trial · ends {date()} ({days()} days left)
          </Trans>
        </Match>
        <Match when={props.view.state === 'active'}>
          <Trans>Active · renews {date()}</Trans>
        </Match>
        <Match when={props.view.state === 'canceling'}>
          <Trans>Canceled · access until {date()}</Trans>
        </Match>
        <Match when={props.view.state === 'delinquent'}>
          <Trans>Payment failed · access until {date()}</Trans>
        </Match>
        <Match when={props.view.state === 'ended'}>
          <Trans>Membership ended {date()}</Trans>
        </Match>
        <Match when={props.view.state === 'incomplete'}>
          <Trans>Finishing checkout…</Trans>
        </Match>
        <Match when={props.view.state === 'none'}>
          <Trans>No membership yet.</Trans>
        </Match>
      </Switch>
    </p>
  );
}

function PlanNotice(props: { readonly view: BillingView }): JSX.Element {
  return (
    <Show when={props.view.notice}>
      {(notice) => (
        <Notice
          tone={notice() === 'delinquent' ? 'error' : 'info'}
          dataSet={{ testid: Handles.billingNotice }}
        >
          <Switch>
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
          </Switch>
        </Notice>
      )}
    </Show>
  );
}

function PlanActions(props: {
  readonly view: BillingView;
  readonly trialDays: number;
  readonly actions: BillingActions;
}): JSX.Element {
  const { t } = useLingui();
  const subscribe = useMutationButton({
    operation: () => props.actions.subscribe(),
    labels: {
      get idle() {
        return props.trialDays > 0
          ? t`Start ${props.trialDays}-day free trial`
          : t`Subscribe`;
      },
      loading: t`Opening…`,
      success: t`Opening…`,
      error: t`Couldn't open checkout`,
    },
  });
  const manage = useMutationButton({
    operation: () => props.actions.manage(),
    labels: {
      get idle() {
        return props.view.state === 'delinquent'
          ? t`Update payment method`
          : t`Manage subscription`;
      },
      loading: t`Opening…`,
      success: t`Opening…`,
      error: t`Couldn't open billing`,
    },
  });
  return (
    <div class="box gap-2">
      <Show when={props.view.primary === 'subscribe'}>
        <Button
          {...subscribe.buttonProps}
          fullWidth
          dataSet={{ testid: Handles.billingSubscribe }}
        />
      </Show>
      <Show when={props.view.primary === 'unlock' && props.view.unlockLabel}>
        {(label) => (
          <Button
            title={label()}
            icon={KeyRoundIcon}
            fullWidth
            onClick={() => props.actions.unlock()}
            dataSet={{ testid: Handles.billingUnlock }}
          />
        )}
      </Show>
      <Show when={props.view.manage}>
        <Button
          {...manage.buttonProps}
          icon={CreditCardIcon}
          intent={props.view.state === 'delinquent' ? 'primary' : 'neutral'}
          variant={props.view.state === 'delinquent' ? 'solid' : 'outline'}
          fullWidth
          dataSet={{ testid: Handles.billingManage }}
        />
      </Show>
    </div>
  );
}

export function BillingPlanCard(props: PlanCardProps): JSX.Element {
  return (
    <section class="box gap-4 rounded-card border border-border bg-surface p-5 shadow-sm">
      <div class="box flex-row items-center gap-3">
        <div class="box h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tint-subtle">
          <CreditCardIcon size={24} color="tint" />
        </div>
        <div class="box min-w-0 flex-1 gap-1">
          <p class="text textCaption text-text-secondary">
            <Trans>Your plan</Trans>
          </p>
          <p class="text textTitle">
            <PlanTitle tier={props.view.tier} productName={props.productName} />
          </p>
        </div>
        <TierChip tier={props.view.tier} />
      </div>
      <StatusLine view={props.view} formatDate={props.formatDate} />
      <PlanNotice view={props.view} />
      <PlanActions
        view={props.view}
        trialDays={props.trialDays}
        actions={props.actions}
      />
    </section>
  );
}
