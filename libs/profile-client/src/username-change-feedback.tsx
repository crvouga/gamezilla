import { claimUsernameMutation } from '@libs/profile-shared/claim-username-mutation';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { useMutationFeedback } from '@pkgs/sync-engine-client/use-mutation-feedback';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { Notice } from '@pkgs/ui-root-client/notice';
import { type JSX, Show } from 'solid-js';
import { usernameErrorLabel } from './username-error-label';

/** The outcome remains visible after leaving the editor or reopening the app. */
export function UsernameChangeFeedback(props: {
  readonly onChoose?: (() => void) | undefined;
}): JSX.Element {
  const feedback = useMutationFeedback(claimUsernameMutation.name);
  const engine = useSyncEngine();
  return (
    <>
      <Show when={feedback()?.status === 'pending'}>
        <Notice dataSet={{ testid: Handles.profileUsernamePending }}>
          <Show
            when={engine.status().online}
            fallback={
              <Trans>
                Your username change will be shared when the connection returns.
              </Trans>
            }
          >
            <Trans>Sharing your username change…</Trans>
          </Show>
        </Notice>
      </Show>
      <Show when={feedback()?.status === 'rejected'}>
        <ErrorState
          variant="compact"
          title={usernameErrorLabel({ code: feedback()?.code ?? '' })}
          body={
            <Trans>
              This username change could not be shared. Choose another username.
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
            code: feedback()?.code ?? '',
          }}
        />
      </Show>
    </>
  );
}
