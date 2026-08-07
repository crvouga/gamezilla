import { Trans } from '@lingui/react/macro';
import { MutationModal } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type EndSpaceConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Runs the end-space write. Surfaces loading / success / error in place. */
  operation: () => Promise<void>;
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: () => void;
};

/** Confirm-end shell (space-agnostic; action wiring lives at the call site). */
export function EndSpaceConfirmModal({
  visible,
  onClose,
  operation,
  onSuccess,
}: EndSpaceConfirmModalProps): ReactNode {
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
      loadingLabel={<Trans>Ending space…</Trans>}
      successTitle={<Trans>Space ended</Trans>}
      successBody={<Trans>Everyone has been returned to the lobby.</Trans>}
      errorTitle={<Trans>Couldn't end space</Trans>}
      stackId="end-space-confirm"
    />
  );
}
