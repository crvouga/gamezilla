/** @jsxImportSource solid-js */

import {
  useCurrentUser,
  useIsSignedIn,
} from '@libs/auth/public/use-current-user';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useClock } from '@pkgs/clock/solid';
import {
  Button,
  MenuRow,
  MenuSection,
  useMutationButton,
  useRouter,
} from '@pkgs/ui';
import {
  type Accessor,
  createMemo,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';

import { CATALOG_SPEC } from '../../shared/catalog/catalog-spec';
import {
  cancelsAtPeriodEnd,
  type MembershipStatusKind,
  membershipStatusKind,
  subscriptionEntitled,
} from '../../shared/membership/subscription-entitled';
import {
  type MySubscriptionRow,
  useMySubscription,
} from '../../use-cases/load-my-subscription/client/use-my-subscription';
import { useBillingHttp } from './use-billing-http';

function useFormatDate(): (iso: string | null) => string {
  const { i18n } = useLinguiRuntime();
  return (iso) => {
    if (iso === null) return '';
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return '';
    return new Intl.DateTimeFormat(i18n().locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(ms));
  };
}

function MembershipStatusValue(props: {
  kind: MembershipStatusKind;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Switch fallback={<>{t`Not subscribed`}</>}>
      <Match when={props.kind === 'trial'}>{t`Free trial`}</Match>
      <Match when={props.kind === 'active'}>{t`Active`}</Match>
      <Match when={props.kind === 'past_due'}>{t`Payment past due`}</Match>
      <Match when={props.kind === 'canceled'}>{t`Canceled`}</Match>
      <Match when={props.kind === 'expired'}>{t`Expired`}</Match>
      <Match when={props.kind === 'incomplete'}>{t`Payment required`}</Match>
    </Switch>
  );
}

function PlanValue(props: { priceKey: string | null }): JSX.Element {
  const { t } = useLingui();
  const product = CATALOG_SPEC.products.subscription.name;
  return (
    <Switch fallback={<>{product}</>}>
      <Match when={props.priceKey === 'subscription_monthly'}>
        {t`${product} monthly`}
      </Match>
      <Match when={props.priceKey === 'subscription_yearly'}>
        {t`${product} yearly`}
      </Match>
    </Switch>
  );
}

function boundaryIso(row: MySubscriptionRow): string | null {
  if (row.status === 'trialing') return row.trial_end;
  if (row.status === 'past_due') return row.grace_until;
  return row.current_period_end;
}

function BoundaryTitle(props: { row: MySubscriptionRow }): JSX.Element {
  const { t } = useLingui();
  const ending = (): boolean =>
    props.row.status === 'canceled' ||
    props.row.status === 'past_due' ||
    cancelsAtPeriodEnd(props.row.cancel_at_period_end);
  return (
    <Switch fallback={<>{t`Renews`}</>}>
      <Match when={props.row.status === 'trialing'}>{t`Trial ends`}</Match>
      <Match when={ending()}>{t`Access until`}</Match>
    </Switch>
  );
}

function BoundaryRow(props: { row: MySubscriptionRow }): JSX.Element {
  const format = useFormatDate();
  const when = createMemo(() => format(boundaryIso(props.row)));
  return (
    <Show when={when().length > 0}>
      <MenuRow title={<BoundaryTitle row={props.row} />} value={when()} />
    </Show>
  );
}

function MembershipRows(props: {
  row: Accessor<MySubscriptionRow | null>;
  kind: Accessor<MembershipStatusKind>;
}): JSX.Element {
  return (
    <>
      <MenuRow
        title={<Trans>Plan</Trans>}
        value={<PlanValue priceKey={props.row()?.price_key ?? null} />}
      />
      <MenuRow
        title={<Trans>Status</Trans>}
        value={<MembershipStatusValue kind={props.kind()} />}
        dataSet={{ testid: 'billing-membership-status' }}
      />
      <Show when={props.row()}>{(row) => <BoundaryRow row={row()} />}</Show>
    </>
  );
}

function MembershipActions(props: {
  signedIn: Accessor<boolean>;
  entitled: Accessor<boolean>;
  hasCustomer: Accessor<boolean>;
}): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  const billing = useBillingHttp();
  const manage = useMutationButton({
    operation: () => billing.manage(),
    labels: {
      get idle() {
        return t`Manage subscription`;
      },
      get loading() {
        return t`Opening billing…`;
      },
      get success() {
        return t`Redirecting`;
      },
      get error() {
        return t`Couldn't open billing`;
      },
    },
    successHoldMs: 0,
  });
  const showActions = (): boolean =>
    !props.signedIn() || props.entitled() || props.hasCustomer();
  return (
    <Show when={showActions()}>
      <div class="box gap-3 p-3">
        <Show
          when={props.signedIn()}
          fallback={
            <Button
              title={t`Sign in`}
              intent="primary"
              onClick={() => router.push('/more/account')}
              dataSet={{ testid: 'billing-sign-in' }}
            />
          }
        >
          <Button
            {...manage.buttonProps}
            intent="primary"
            dataSet={{ testid: 'billing-manage' }}
          />
        </Show>
      </div>
    </Show>
  );
}

export function BillingMembershipSection(): JSX.Element {
  const row = useMySubscription();
  const clock = useClock();
  const signedIn = useIsSignedIn();
  const user = useCurrentUser();
  const kind = createMemo(() =>
    membershipStatusKind(
      row()?.status ?? null,
      subscriptionEntitled(row(), clock.now())
    )
  );
  const entitled = createMemo(() => subscriptionEntitled(row(), clock.now()));
  const hasCustomer = createMemo(() => user.billingCustomerId !== null);
  return (
    <MenuSection
      title={<Trans>Membership</Trans>}
      dataSet={{ testid: 'billing-membership' }}
    >
      <MembershipRows row={row} kind={kind} />
      <MembershipActions
        signedIn={signedIn}
        entitled={entitled}
        hasCustomer={hasCustomer}
      />
    </MenuSection>
  );
}
