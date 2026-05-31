import { useSpaceActions } from './space-actions';
import { LeaveSpaceConfirmModal } from './leave-space-confirm-modal';
import { useRouter } from 'expo-router';
import { useCallback, type ReactNode } from 'react';

export type LeaveSpaceModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * Leave-space modal keyed by `spaceId`. Owns its own dispatch via
 * {@link useSpaceActions} and navigates back once the success state is
 * dismissed.
 */
export function LeaveSpaceModal({
  spaceId,
  visible,
  onClose,
}: LeaveSpaceModalProps): ReactNode {
  const router = useRouter();
  const { leaveSpace } = useSpaceActions();
  const operation = useCallback(
    () => leaveSpace(spaceId),
    [leaveSpace, spaceId]
  );

  return (
    <LeaveSpaceConfirmModal
      visible={visible}
      onClose={onClose}
      operation={operation}
      onSuccess={() => router.back()}
    />
  );
}
