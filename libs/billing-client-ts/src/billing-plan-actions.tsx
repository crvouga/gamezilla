/** @jsxImportSource solid-js */
/**
 * The plan card's actions: the one that moves the membership forward, the
 * billing portal, a "check again" after a paid checkout that has not shown,
 * and — when opening checkout or the portal fails — what happened and
 * whether anything was charged.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  CreditCardIcon,
  KeyRoundIcon,
  RefreshCwIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  type UseMutationButtonResult,
  useMutationButton,
} from '@pkgs/ui-root-client-ts/use-mutation-button';
import { type JSX, Match, Show, Switch } from 'solid-js';

import type { BillingRequestFailure } from './billing-request-error';
import { billingFailureIn } from './billing-request-error';
import type { BillingView } from './billing-view-model';

export type BillingActions = {
  readonly subscribe: () => Promise<void>;
  readonly manage: () => Promise<void>;
  /** Runs the subscribe denial's unlock (the permission system's CTA). */
  readonly unlock: () => void;
  /** Look again for the membership a paid checkout should have made. */
  readonly checkAgain: () => void;
};

/** A failure the screen explains beyond the button's own face, or `null`. */
function explained(error: unknown): BillingRequestFailure | null {
  const failure = billingFailureIn(error);
  return failure === 'failed' ? null : failure;
}

/** Why opening checkout or the portal failed, in plain words. */
function ActionFailure(props: {
  readonly failure: BillingRequestFailure;
  readonly opening: 'checkout' | 'portal';
}): JSX.Element {
  return (
    <P
      variant="caption"
      tone="secondary"
      role="status"
      testId={Handles.billingActionFailure}
      dataSet={{ failure: props.failure }}
    >
      <Switch>
        <Match when={props.failure === 'has_membership'}>
          <Trans>
            This account already has a membership, so nothing was charged.
            Looking for it now.
          </Trans>
        </Match>
        <Match
          when={
            props.failure === 'provider_unavailable' &&
            props.opening === 'checkout'
          }
        >
          <Trans>
            The payment provider can't be reached right now. Nothing was charged
            — try again in a moment.
          </Trans>
        </Match>
        <Match when={props.failure === 'provider_unavailable'}>
          <Trans>
            The payment provider can't be reached right now. Nothing changed —
            try again in a moment.
          </Trans>
        </Match>
      </Switch>
    </P>
  );
}

function useSubscribeButton(props: {
  readonly view: BillingView;
  readonly trialDays: number;
  readonly actions: BillingActions;
}): UseMutationButtonResult {
  const { t } = useLingui();
  const button: UseMutationButtonResult = useMutationButton({
    operation: () => props.actions.subscribe(),
    get disabled() {
      return props.view.notice === 'offline';
    },
    labels: {
      get idle() {
        return props.trialDays > 0
          ? t`Start ${props.trialDays}-day free trial`
          : t`Subscribe`;
      },
      loading: t`Opening…`,
      success: t`Opening…`,
      get error() {
        const failure = billingFailureIn(button.error());
        if (failure === 'has_membership')
          return t`You already have a membership`;
        if (failure === 'provider_unavailable') return t`Try again in a moment`;
        return t`Couldn't open checkout`;
      },
    },
  });
  return button;
}

function useManageButton(props: {
  readonly view: BillingView;
  readonly actions: BillingActions;
}): UseMutationButtonResult {
  const { t } = useLingui();
  const button: UseMutationButtonResult = useMutationButton({
    operation: () => props.actions.manage(),
    labels: {
      get idle() {
        return props.view.state === 'delinquent'
          ? t`Update payment method`
          : t`Manage subscription`;
      },
      loading: t`Opening…`,
      success: t`Opening…`,
      get error() {
        return billingFailureIn(button.error()) === 'provider_unavailable'
          ? t`Try again in a moment`
          : t`Couldn't open billing`;
      },
    },
  });
  return button;
}

export function BillingPlanActions(props: {
  readonly view: BillingView;
  readonly trialDays: number;
  readonly actions: BillingActions;
}): JSX.Element {
  const { t } = useLingui();
  const subscribe = useSubscribeButton(props);
  const manage = useManageButton(props);
  const delinquent = (): boolean => props.view.state === 'delinquent';
  return (
    <StackVertical gap="sm">
      <Show when={props.view.checkAgain}>
        <Button
          title={t`Check again`}
          icon={RefreshCwIcon}
          fullWidth
          onClick={() => props.actions.checkAgain()}
          dataSet={{ testid: Handles.billingCheckAgain }}
        />
      </Show>
      <Show when={props.view.primary === 'subscribe'}>
        <Button
          {...subscribe.buttonProps}
          fullWidth
          dataSet={{ testid: Handles.billingSubscribe }}
        />
        <Show when={explained(subscribe.error())}>
          {(failure) => (
            <ActionFailure failure={failure()} opening="checkout" />
          )}
        </Show>
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
          intent={delinquent() ? 'primary' : 'neutral'}
          variant={delinquent() ? 'solid' : 'outline'}
          fullWidth
          dataSet={{ testid: Handles.billingManage }}
        />
        <Show when={explained(manage.error())}>
          {(failure) => <ActionFailure failure={failure()} opening="portal" />}
        </Show>
      </Show>
    </StackVertical>
  );
}
