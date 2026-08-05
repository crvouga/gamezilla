import { MutationModal } from '@pkgs/ui';
import { Sounds } from '@pkgs/sounds';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type LeaveSpaceConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Runs the leave-membership write. Surfaces loading / success / error in place. */
  operation: () => Promise<void>;
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: () => void;
  /**
   * Host leave ends the space for everyone (I4). UI normally routes hosts to
   * End; this copy covers the leave write path when the actor is still host.
   */
  asHost?: boolean;
};

/** Confirm-leave shell (space-agnostic; action wiring lives at the call site). */
export function LeaveSpaceConfirmModal({
  visible,
  onClose,
  operation,
  onSuccess,
  asHost = false,
}: LeaveSpaceConfirmModalProps): ReactNode {
  if (asHost) {
    return (
      <MutationModal
        visible={visible}
        onClose={onClose}
        title={<Trans>End space?</Trans>}
        message={
          <Trans>Everyone will leave this space. This cannot be undone.</Trans>
        }
        submitLabel={<Trans>End space</Trans>}
        variant="destructive"
        operation={operation}
        onSuccess={onSuccess}
        sounds={{
          success: Sounds.social.roomLeft,
          error: Sounds.feedback.error,
        }}
        loadingLabel={<Trans>Ending space…</Trans>}
        successTitle={<Trans>Space ended</Trans>}
        successBody={<Trans>Everyone has been returned to the lobby.</Trans>}
        errorTitle={<Trans>Couldn't end space</Trans>}
        stackId="leave-space-confirm-as-host"
      />
    );
  }

  return (
    <MutationModal
      visible={visible}
      onClose={onClose}
      title={<Trans>Leave space?</Trans>}
      message={
        <Trans>
          Leave this space on your account. You will leave on every device. You
          can join again later if the space is still live.
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
      stackId="leave-space-confirm"
    />
  );
}
