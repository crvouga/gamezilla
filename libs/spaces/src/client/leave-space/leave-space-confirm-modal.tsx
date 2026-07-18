import { MutationModal } from '@pkgs/ui';
import { Sounds } from '@pkgs/sounds';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type LeaveSpaceConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Runs the leave-this-device write. Surfaces loading / success / error in place. */
  operation: () => Promise<void>;
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
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
        <Trans>
          Leave on this device only. Other devices stay in the space until you
          leave there too. You can join again later if the space is still live.
        </Trans>
      }
      submitLabel={<Trans>Leave</Trans>}
      operation={operation}
      onSuccess={onSuccess}
      sounds={{
        success: Sounds.social.roomLeft,
        error: Sounds.feedback.error,
      }}
      loadingLabel={<Trans>Leaving…</Trans>}
      successTitle={<Trans>You left the space</Trans>}
      successBody={
        <Trans>
          You can rejoin from the invite link if the space is still live.
        </Trans>
      }
      errorTitle={<Trans>Couldn't leave space</Trans>}
    />
  );
}
