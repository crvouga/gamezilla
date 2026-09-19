import { Handles } from '@libs/test-ids';

import { Trans } from '@lingui/solid/macro';
import { ConfirmationModal } from '@pkgs/ui';
import type { JSX } from 'solid-js';

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
      <ConfirmationModal
        visible={props.removeOpen}
        title={<Trans>Remove friend?</Trans>}
        message={<Trans>They will be removed from your friends list.</Trans>}
        variant="destructive"
        confirmLabel={<Trans>Remove</Trans>}
        confirmDataSet={{ testid: Handles.friendRemoveConfirm(props.username) }}
        onConfirm={props.onRemove}
        onCancel={props.onCloseRemove}
      />
      <ConfirmationModal
        visible={props.blockOpen}
        title={<Trans>Block this user?</Trans>}
        message={<Trans>They won't be able to send you friend requests.</Trans>}
        variant="destructive"
        confirmLabel={<Trans>Block</Trans>}
        confirmDataSet={{ testid: Handles.friendBlockConfirm(props.username) }}
        onConfirm={props.onBlock}
        onCancel={props.onCloseBlock}
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
