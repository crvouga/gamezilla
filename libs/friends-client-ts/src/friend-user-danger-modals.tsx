import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import type { JSX } from 'solid-js';

/** Confirm, progress, retry and dismissible success stay on the person's profile. */
export function FriendUserDangerModals(props: {
  username: string;
  removeOpen: boolean;
  blockOpen: boolean;
  onCloseRemove: () => void;
  onCloseBlock: () => void;
  onRemove: () => Promise<void>;
  onBlock: () => Promise<void>;
}): JSX.Element {
  return (
    <>
      <MutationModal
        visible={props.removeOpen}
        title={<Trans>Remove friend?</Trans>}
        message={<Trans>They will be removed from your friends list.</Trans>}
        variant="destructive"
        submitLabel={<Trans>Remove</Trans>}
        loadingLabel={<Trans>Removing friend…</Trans>}
        successTitle={<Trans>Friend removed</Trans>}
        errorTitle={<Trans>This friend could not be removed. Try again.</Trans>}
        submitDataSet={{ testid: Handles.friendRemoveConfirm(props.username) }}
        cancelDataSet={{ testid: Handles.friendRemoveCancel(props.username) }}
        successDataSet={{ testid: Handles.friendRemoveSuccess(props.username) }}
        dismissDataSet={{ testid: Handles.friendRemoveDone(props.username) }}
        operation={() => props.onRemove()}
        onClose={() => props.onCloseRemove()}
      />
      <MutationModal
        visible={props.blockOpen}
        title={<Trans>Block this user?</Trans>}
        message={
          <Trans>
            Blocking ends any friendship or friend request between you. They
            won't be able to find you or send you friend requests. You can
            unblock them from their profile later.
          </Trans>
        }
        variant="destructive"
        submitLabel={<Trans>Block</Trans>}
        loadingLabel={<Trans>Blocking user…</Trans>}
        successTitle={<Trans>User blocked</Trans>}
        errorTitle={<Trans>This user could not be blocked. Try again.</Trans>}
        submitDataSet={{ testid: Handles.friendBlockConfirm(props.username) }}
        successDataSet={{ testid: Handles.friendBlockSuccess(props.username) }}
        dismissDataSet={{ testid: Handles.friendBlockDone(props.username) }}
        operation={() => props.onBlock()}
        onClose={() => props.onCloseBlock()}
      />
    </>
  );
}
