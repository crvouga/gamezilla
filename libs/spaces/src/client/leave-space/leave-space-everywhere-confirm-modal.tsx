import { MutationModal } from '@pkgs/ui';
import { Sounds } from '@pkgs/sounds';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type LeaveSpaceEverywhereConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  operation: () => Promise<void>;
  onSuccess?: () => void;
};

export function LeaveSpaceEverywhereConfirmModal({
  visible,
  onClose,
  operation,
  onSuccess,
}: LeaveSpaceEverywhereConfirmModalProps): ReactNode {
  return (
    <MutationModal
      visible={visible}
      onClose={onClose}
      title={<Trans>Leave on all devices?</Trans>}
      message={
        <Trans>
          You will leave this space on every device signed into this account.
        </Trans>
      }
      submitLabel={<Trans>Leave everywhere</Trans>}
      variant="destructive"
      operation={operation}
      onSuccess={onSuccess}
      sounds={{
        success: Sounds.social.roomLeft,
        error: Sounds.feedback.error,
      }}
      loadingLabel={<Trans>Leaving…</Trans>}
      successTitle={<Trans>You left everywhere</Trans>}
      successBody={
        <Trans>
          You can rejoin from the invite link if the space is still live.
        </Trans>
      }
      errorTitle={<Trans>Couldn't leave space</Trans>}
    />
  );
}
