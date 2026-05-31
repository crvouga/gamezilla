import { MutationModal } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type LeaveSpaceConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Runs the leave-space write. Surfaces loading / success / error in place. */
  operation: () => Promise<void>;
  /** Runs after the user dismisses the success state (e.g. navigation). */
  onSuccess?: () => void;
};

/** Confirm-leave shell (space-agnostic; action wiring lives at the call site). */
export function LeaveSpaceConfirmModal({
  visible,
  onClose,
  operation,
  onSuccess,
}: LeaveSpaceConfirmModalProps): ReactNode {
  return (
    <MutationModal
      visible={visible}
      onClose={onClose}
      title={<Trans>Leave space?</Trans>}
      message={
        <Trans>You can join again later if the space is still live.</Trans>
      }
      submitLabel={<Trans>Leave</Trans>}
      operation={operation}
      onSuccess={onSuccess}
      loadingLabel={<Trans>Leaving…</Trans>}
      successTitle={<Trans>You left the space</Trans>}
      errorTitle={<Trans>Couldn't leave space</Trans>}
    />
  );
}
