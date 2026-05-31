import { useSpaceActions } from './space-actions';
import { EndSpaceConfirmModal } from './end-space-confirm-modal';
import { useRouter } from 'expo-router';
import { useCallback, type ReactNode } from 'react';

export type EndSpaceModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * End-space modal keyed by `spaceId`. Owns its own dispatch via
 * {@link useSpaceActions} and navigates back once the success state is
 * dismissed.
 */
export function EndSpaceModal({
  spaceId,
  visible,
  onClose,
}: EndSpaceModalProps): ReactNode {
  const router = useRouter();
  const { endSpace } = useSpaceActions();
  const operation = useCallback(() => endSpace(spaceId), [endSpace, spaceId]);

  return (
    <EndSpaceConfirmModal
      visible={visible}
      onClose={onClose}
      operation={operation}
      onSuccess={() => router.back()}
    />
  );
}
