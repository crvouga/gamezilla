import { useSpaceActions } from './space-actions';
import { EndSpaceConfirmModal } from './end-space-confirm-modal';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

export type EndSpaceModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * End-space modal keyed by `spaceId`. Owns its own dispatch via
 * {@link useSpaceActions} and navigates back on confirm.
 */
export function EndSpaceModal({
  spaceId,
  visible,
  onClose,
}: EndSpaceModalProps): ReactNode {
  const router = useRouter();
  const { endSpace } = useSpaceActions();

  return (
    <EndSpaceConfirmModal
      visible={visible}
      onClose={onClose}
      onConfirm={() => {
        onClose();
        void (async () => {
          await endSpace(spaceId);
          router.back();
        })();
      }}
    />
  );
}
