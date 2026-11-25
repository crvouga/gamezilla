import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import type { JSX } from '@solidjs/web';
import { Match, Show, Switch } from 'solid-js';
import type { SpaceJoinScreenViewProps } from './space-join-screen-view';
import { SpaceRecoveryBar } from './space-recovery-bar';

function SpaceJoinButton(props: SpaceJoinScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const join = useMutationButton({
    operation: () => props.onJoin(),
    labels: {
      get idle() {
        if (props.joinPending) return t`Check again`;
        // Without a connection the command names what it needs, so it reads
        // whole after the connection toast has gone.
        return props.needsConnection ? t`Reconnect and join` : t`Join space`;
      },
      get loading() {
        return t`Joining…`;
      },
      get success() {
        return t`Joined`;
      },
      get error() {
        return t`Couldn't join`;
      },
    },
    get disabled() {
      return props.joinDisabled;
    },
    onPhaseChange: (transition) => props.onJoinPhaseChange?.(transition),
  });
  return (
    <Button
      {...join.buttonProps}
      flex={1}
      dataSet={{ testid: Handles.spaceJoin }}
    />
  );
}

/**
 * Join; while the host is away, the way back to Spaces instead, and Leave
 * for someone on the space's list.
 */
function JoinPromptFooter(props: SpaceJoinScreenViewProps): JSX.Element {
  return (
    <StackHorizontal gap="sm">
      <Show
        when={props.connection === 'host-offline'}
        fallback={
          // Back to Spaces on the left, outlined, and joining (or checking
          // again, or trying again) filled on the right, in every state.
          <>
            <Show when={props.joinPending || props.needsConnection}>
              <Button
                title={<Trans>Back to Spaces</Trans>}
                intent="neutral"
                variant="outline"
                flex={1}
                onClick={() => props.onBackToSpaces()}
              />
            </Show>
            <SpaceJoinButton {...props} />
          </>
        }
      >
        {/* The one way on, filled, on the right as in every Join and
            recovery pair; leaving, outlined, beside it. */}
        <Show when={props.canLeave}>
          <Button
            title={<Trans>Leave space</Trans>}
            intent="neutral"
            variant="outline"
            flex={1}
            dataSet={{ testid: Handles.spaceLeave }}
            onClick={() => props.onLeave()}
          />
        </Show>
        <Button
          title={<Trans>Back to Spaces</Trans>}
          flex={1}
          onClick={() => props.onBackToSpaces()}
        />
      </Show>
    </StackHorizontal>
  );
}

/**
 * Offline: asks the server again, as "Reconnect and join" does when joining
 * needed the connection; the button says in place whether it is back.
 */
function SpaceJoinRetryButton(props: {
  readonly onRetry: () => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
  const retry = useMutationButton({
    operation: () => props.onRetry(),
    labels: {
      get idle() {
        return t`Try again`;
      },
      get loading() {
        return t`Checking…`;
      },
      get success() {
        return t`Connected`;
      },
      get error() {
        return t`Still offline`;
      },
    },
  });
  return (
    <Button
      {...retry.buttonProps}
      flex={1}
      dataSet={{ testid: Handles.spaceJoinRetry }}
    />
  );
}

/**
 * A state that cannot join: the way back to Spaces, and while offline,
 * Try again beside it, filled on the right as in every recovery pair.
 */
function SpaceJoinRecoveryFooter(props: SpaceJoinScreenViewProps): JSX.Element {
  const offline = (): boolean => props.status === 'offline';
  return (
    <SpaceRecoveryBar>
      <Button
        title={<Trans>Back to Spaces</Trans>}
        intent={offline() ? 'neutral' : undefined}
        variant={offline() ? 'outline' : undefined}
        flex={1}
        onClick={() => props.onBackToSpaces()}
        // The addresses its empty state's action had.
        dataSet={
          props.status === 'missing'
            ? { testid: Handles.spaceNotFoundBack }
            : offline()
              ? { testid: `${Handles.spacesNeedConnection}-action` }
              : undefined
        }
      />
      <Show when={offline()}>
        <SpaceJoinRetryButton onRetry={props.onRetry} />
      </Show>
    </SpaceRecoveryBar>
  );
}

/** The join screen's bottom bar, for every state it can be in. */
export function SpaceJoinFooter(props: SpaceJoinScreenViewProps): JSX.Element {
  return (
    <Switch>
      <Match when={props.status === 'live' && props.connection !== 'loading'}>
        <JoinPromptFooter {...props} />
      </Match>
      {/* While the host's connection is checked, the way back waits
          in the bar, as in every other state. */}
      <Match when={props.status === 'live' && props.connection === 'loading'}>
        <Button
          title={<Trans>Back to Spaces</Trans>}
          intent="neutral"
          variant="outline"
          fullWidth
          onClick={() => props.onBackToSpaces()}
        />
      </Match>
      {/* Every state that cannot join keeps the same bottom bar, with
          its one way on filled. */}
      <Match
        when={
          props.status === 'unavailable' ||
          props.status === 'missing' ||
          props.status === 'offline'
        }
      >
        <SpaceJoinRecoveryFooter {...props} />
      </Match>
    </Switch>
  );
}
