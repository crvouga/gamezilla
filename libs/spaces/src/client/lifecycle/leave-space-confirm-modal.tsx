import { ConfirmationModal } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type LeaveSpaceConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** Confirm-leave shell (space-agnostic; action wiring lives at the call site). */
export function LeaveSpaceConfirmModal({
  visible,
  onClose,
  onConfirm,
}: LeaveSpaceConfirmModalProps): ReactNode {
  return (
    <ConfirmationModal
      visible={visible}
      title={<Trans>Leave space?</Trans>}
      message={
        <Trans>You can join again later if the space is still live.</Trans>
      }
      confirmLabel={<Trans>Leave</Trans>}
      cancelLabel={<Trans>Cancel</Trans>}
      variant="default"
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
