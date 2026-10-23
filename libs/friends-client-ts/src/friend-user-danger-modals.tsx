import { Handles } from '@libs/test-ids-shared-ts/handles';

import { Trans } from '@lingui/solid/macro';
import { ConfirmationModal } from '@pkgs/ui-root-client-ts/confirmation-modal';
import type { Accessor, JSX } from 'solid-js';
import { createSignal } from 'solid-js';

/** One confirm-first mutation: in flight, failed (retryable), or idle. */
function useConfirmedMutation(run: () => Promise<void>): {
  readonly submitting: Accessor<boolean>;
  readonly failed: Accessor<boolean>;
  readonly confirm: () => Promise<void>;
  readonly reset: () => void;
} {
  const [submitting, setSubmitting] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const confirm = async (): Promise<void> => {
    if (submitting()) return;
    setSubmitting(true);
    setFailed(false);
    try {
      await run();
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };
  return { submitting, failed, confirm, reset: () => setFailed(false) };
}

export function FriendUserDangerModals(props: {
  username: string;
  removeOpen: boolean;
  blockOpen: boolean;
  onCloseRemove: () => void;
  onCloseBlock: () => void;
  onRemove: () => Promise<void>;
  onBlock: () => Promise<void>;
}): JSX.Element {
  const remove = useConfirmedMutation(() => props.onRemove());
  const block = useConfirmedMutation(() => props.onBlock());
  return (
    <>
      <ConfirmationModal
        visible={props.removeOpen}
        title={<Trans>Remove friend?</Trans>}
        message={<Trans>They will be removed from your friends list.</Trans>}
        variant="destructive"
        confirmLabel={<Trans>Remove</Trans>}
        submitting={remove.submitting()}
        confirmError={
          remove.failed() ? (
            <Trans>This friend could not be removed. Try again.</Trans>
          ) : undefined
        }
        confirmDataSet={{ testid: Handles.friendRemoveConfirm(props.username) }}
        cancelDataSet={{ testid: Handles.friendRemoveCancel(props.username) }}
        onConfirm={remove.confirm}
        onCancel={() => {
          remove.reset();
          props.onCloseRemove();
        }}
      />
      <ConfirmationModal
        visible={props.blockOpen}
        title={<Trans>Block this user?</Trans>}
        message={<Trans>They won't be able to send you friend requests.</Trans>}
        variant="destructive"
        confirmLabel={<Trans>Block</Trans>}
        submitting={block.submitting()}
        confirmError={
          block.failed() ? (
            <Trans>This user could not be blocked. Try again.</Trans>
          ) : undefined
        }
        confirmDataSet={{ testid: Handles.friendBlockConfirm(props.username) }}
        onConfirm={block.confirm}
        onCancel={() => {
          block.reset();
          props.onCloseBlock();
        }}
      />
    </>
  );
}

export function createFriendUserDangerHandlers({
  removeFriend,
  blockUser,
  setRemoveOpen,
  setBlockOpen,
  routerBack,
}: {
  removeFriend: () => Promise<void>;
  blockUser: () => Promise<void>;
  setRemoveOpen: (open: boolean) => void;
  setBlockOpen: (open: boolean) => void;
  routerBack: () => void;
}) {
  return {
    onRemove: async () => {
      await removeFriend();
      setRemoveOpen(false);
      routerBack();
    },
    onBlock: async () => {
      await blockUser();
      setBlockOpen(false);
      routerBack();
    },
  };
}
