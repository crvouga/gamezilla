import { sendFriendRequestMutation } from '@libs/friends-shared/send-friend-request-mutation';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { useMutationFeedback } from '@pkgs/sync-engine-client/use-mutation-feedback';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { Notice } from '@pkgs/ui-root-client/notice';
import { type JSX, Show } from 'solid-js';
import { friendRequestErrorLabel } from './friend-request-error-label';

/** Keep the outcome beside this person's profile across app reopening. */
export function FriendRequestFeedback(props: {
  readonly userId: string;
  readonly outgoingRequestId: string | null;
}): JSX.Element {
  const engine = useSyncEngine();
  const feedback = useMutationFeedback(sendFriendRequestMutation.name, () => ({
    toUserId: props.userId,
  }));
  return (
    <>
      <Show
        when={
          feedback()?.status === 'pending' && props.outgoingRequestId !== null
        }
      >
        <Notice dataSet={{ testid: Handles.friendRequestPending }}>
          <Show
            when={engine.status().online}
            fallback={
              <Trans>
                Your friend request will be shared when the connection returns.
              </Trans>
            }
          >
            <Trans>Sharing your friend request…</Trans>
          </Show>
        </Notice>
      </Show>
      <Show when={feedback()?.status === 'rejected'}>
        <ErrorState
          variant="compact"
          title={friendRequestErrorLabel(feedback()?.code ?? '')}
          dataSet={{ testid: Handles.friendRequestRefusal }}
        />
      </Show>
    </>
  );
}
