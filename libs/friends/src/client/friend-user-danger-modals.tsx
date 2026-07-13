import { ConfirmationModal } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export function FriendUserDangerModals({
  removeOpen,
  blockOpen,
  onCloseRemove,
  onCloseBlock,
  onRemove,
  onBlock,
}: {
  removeOpen: boolean;
  blockOpen: boolean;
  onCloseRemove: () => void;
  onCloseBlock: () => void;
  onRemove: () => Promise<void>;
  onBlock: () => Promise<void>;
}): ReactNode {
  return (
    <>
      <ConfirmationModal
        visible={removeOpen}
        title={<Trans>Remove friend?</Trans>}
        message={<Trans>They will be removed from your friends list.</Trans>}
        variant="destructive"
        confirmLabel={<Trans>Remove</Trans>}
        onConfirm={onRemove}
        onCancel={onCloseRemove}
      />
      <ConfirmationModal
        visible={blockOpen}
        title={<Trans>Block this user?</Trans>}
        message={<Trans>They won't be able to send you friend requests.</Trans>}
        variant="destructive"
        confirmLabel={<Trans>Block</Trans>}
        onConfirm={onBlock}
        onCancel={onCloseBlock}
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
