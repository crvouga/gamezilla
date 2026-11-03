import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { type JSX, Match, Switch } from 'solid-js';
import { usernameErrorLabel } from './username-error-label';

/**
 * Where the person's last username change stands: still being shared
 * (online or waiting for a connection) or refused with the server's code.
 */
export type UsernameChange =
  | { readonly status: 'pending'; readonly online: boolean }
  | { readonly status: 'rejected'; readonly code: string };

/** Presentational half of `UsernameChangeFeedback`: renders a known outcome. */
export function UsernameChangeFeedbackView(props: {
  readonly change: UsernameChange | null;
  readonly onChoose?: (() => void) | undefined;
}): JSX.Element {
  return (
    <Switch>
      <Match
        when={props.change?.status === 'pending' ? props.change : undefined}
      >
        {(pending) => (
          <Notice dataSet={{ testid: Handles.profileUsernamePending }}>
            <Switch
              fallback={
                <Trans>
                  Your username change will be shared when the connection
                  returns.
                </Trans>
              }
            >
              <Match when={pending().online}>
                <Trans>Sharing your username change…</Trans>
              </Match>
            </Switch>
          </Notice>
        )}
      </Match>
      <Match
        when={props.change?.status === 'rejected' ? props.change : undefined}
      >
        {(rejected) => (
          <ErrorState
            variant="compact"
            title={usernameErrorLabel({ code: rejected().code })}
            body={
              <Trans>
                This username change could not be shared. Choose another
                username.
              </Trans>
            }
            retry={
              props.onChoose === undefined
                ? undefined
                : {
                    label: <Trans>Choose a username</Trans>,
                    onClick: props.onChoose,
                  }
            }
            dataSet={{
              testid: Handles.profileUsernameRefusal,
              code: rejected().code,
            }}
          />
        )}
      </Match>
    </Switch>
  );
}
