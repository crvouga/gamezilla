import { useSpaceActions } from './space-actions';
import { LeaveSpaceConfirmModal } from './leave-space-confirm-modal';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

export type LeaveSpaceModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * Leave-space modal keyed by `spaceId`. Owns its own dispatch via
 * {@link useSpaceActions} and navigates back on confirm.
 */
export function LeaveSpaceModal({
  spaceId,
  visible,
  onClose,
}: LeaveSpaceModalProps): ReactNode {
  const router = useRouter();
  const { leaveSpace } = useSpaceActions();

  return (
    <LeaveSpaceConfirmModal
      visible={visible}
      onClose={onClose}
      onConfirm={() => {
        onClose();
        void leaveSpace(spaceId);
        router.back();
      }}
    />
  );
}
