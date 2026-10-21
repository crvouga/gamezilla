/** @jsxImportSource solid-js */
/**
 * One line on where the membership stands, with its dates: when a trial
 * ends, when it renews, and — for one that will not renew — the last day of
 * paid access, grace included, so nobody is told they lose Plus earlier than
 * they do.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { Plural, Trans } from '@lingui/solid/macro';
import { type JSX, Match, Switch } from 'solid-js';

import type { BillingView } from './billing-view-model';

function isoOf(ms: number | null): string | undefined {
  return ms === null ? undefined : new Date(ms).toISOString();
}

type LineProps = {
  readonly view: BillingView;
  readonly formatDate: (ms: number) => string;
};

/** A membership that will not renew: its end, then the last day of access. */
function NotRenewingLine(props: LineProps): JSX.Element {
  const date = (): string =>
    props.view.periodEndMs === null
      ? ''
      : props.formatDate(props.view.periodEndMs);
  const access = (): string =>
    props.view.accessEndsMs === null
      ? ''
      : props.formatDate(props.view.accessEndsMs);
  const hasAccess = (): boolean => props.view.accessEndsMs !== null;
  const hasDate = (): boolean => props.view.periodEndMs !== null;
  const state = (): BillingView['state'] => props.view.state;
  return (
    <Switch>
      <Match when={state() === 'canceling' && hasAccess()}>
        <Trans>
          Canceled · ends {date()} · Plus access until {access()}
        </Trans>
      </Match>
      <Match when={state() === 'canceling'}>
        <Trans>Canceled · ends {date()}</Trans>
      </Match>
      <Match when={state() === 'delinquent' && hasAccess()}>
        <Trans>Payment failed · Plus access until {access()}</Trans>
      </Match>
      <Match when={state() === 'delinquent'}>
        <Trans>Payment failed</Trans>
      </Match>
      <Match when={hasAccess()}>
        <Trans>
          Membership ended {date()} · Plus access until {access()}
        </Trans>
      </Match>
      <Match when={hasDate()}>
        <Trans>Membership ended {date()}</Trans>
      </Match>
      <Match when={true}>
        <Trans>Membership ended</Trans>
      </Match>
    </Switch>
  );
}

export function BillingStatusLine(props: LineProps): JSX.Element {
  const date = (): string =>
    props.view.periodEndMs === null
      ? ''
      : props.formatDate(props.view.periodEndMs);
  const days = (): number => props.view.daysLeft ?? 0;
  const state = (): BillingView['state'] => props.view.state;
  return (
    <p
      class="text textBody text-text-secondary"
      data-testid={Handles.billingStatus}
      data-state={state()}
      data-period-end={isoOf(props.view.periodEndMs)}
      data-access-end={isoOf(props.view.accessEndsMs)}
    >
      <Switch>
        <Match when={state() === 'loading'}>
          <Trans>Checking your membership…</Trans>
        </Match>
        <Match when={state() === 'trialing'}>
          <Trans>
            Free trial · ends {date()} (
            <Plural value={days()} one="# day left" other="# days left" />)
          </Trans>
        </Match>
        <Match when={state() === 'active'}>
          <Trans>Active · renews {date()}</Trans>
        </Match>
        <Match
          when={
            state() === 'canceling' ||
            state() === 'delinquent' ||
            state() === 'ended'
          }
        >
          <NotRenewingLine view={props.view} formatDate={props.formatDate} />
        </Match>
        <Match when={state() === 'incomplete'}>
          <Trans>Finishing checkout…</Trans>
        </Match>
        <Match when={state() === 'none'}>
          <Trans>No membership yet.</Trans>
        </Match>
      </Switch>
    </p>
  );
}
