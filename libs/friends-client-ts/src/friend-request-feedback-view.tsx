import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { type JSX, Match, Switch } from 'solid-js';
import { friendRequestErrorLabel } from './friend-request-error-label';

/**
 * Where the last friend request to this person stands: still being shared
 * (online or waiting for a connection) or refused with the server's code.
 */
export type FriendRequestOutcome =
  | { readonly status: 'pending'; readonly online: boolean }
  | { readonly status: 'rejected'; readonly code: string };

/** Presentational: the outcome of a friend request beside the profile. */
export function FriendRequestFeedbackView(props: {
  readonly outcome: FriendRequestOutcome | null;
}): JSX.Element {
  return (
    <Switch>
      <Match
        when={props.outcome?.status === 'pending' ? props.outcome : undefined}
      >
        {(pending) => (
          <Notice dataSet={{ testid: Handles.friendRequestPending }}>
            <Switch
              fallback={
                <Trans>
                  Your friend request will be shared when the connection
                  returns.
                </Trans>
              }
            >
              <Match when={pending().online}>
                <Trans>Sharing your friend request…</Trans>
              </Match>
            </Switch>
          </Notice>
        )}
      </Match>
      <Match
        when={props.outcome?.status === 'rejected' ? props.outcome : undefined}
      >
        {(rejected) => (
          <ErrorState
            variant="compact"
            title={<Trans>Friend request not sent</Trans>}
            body={friendRequestErrorLabel(rejected().code)}
            dataSet={{ testid: Handles.friendRequestRefusal }}
          />
        )}
      </Match>
    </Switch>
  );
}
