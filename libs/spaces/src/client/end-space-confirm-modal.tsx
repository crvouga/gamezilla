import { ConfirmationModal } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type EndSpaceConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** Confirm-end shell (space-agnostic; action wiring lives at the call site). */
export function EndSpaceConfirmModal({
  visible,
  onClose,
  onConfirm,
}: EndSpaceConfirmModalProps): ReactNode {
  return (
    <ConfirmationModal
      visible={visible}
      title={<Trans>End space?</Trans>}
      message={
        <Trans>Everyone will leave this space. This cannot be undone.</Trans>
      }
      confirmLabel={<Trans>End space</Trans>}
      cancelLabel={<Trans>Cancel</Trans>}
      variant="destructive"
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
