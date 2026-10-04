import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-client/mutation-modal';
import type { JSX } from 'solid-js';

export type EndSpaceConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Runs the end-space write. Surfaces loading / success / error in place. */
  operation: () => Promise<void>;
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: (() => void) | undefined;
};

/** Confirm-end shell (space-agnostic; action wiring lives at the call site). */
export function EndSpaceConfirmModal(
  props: EndSpaceConfirmModalProps
): JSX.Element {
  const onSuccess = (): void => {
    props.onSuccess?.();
  };
  return (
    <MutationModal
      visible={props.visible}
      onClose={props.onClose}
      title={<Trans>End space?</Trans>}
      message={
        <Trans>Everyone will leave this space. This cannot be undone.</Trans>
      }
      submitLabel={<Trans>End space</Trans>}
      variant="destructive"
      operation={() => props.operation()}
      onSuccess={onSuccess}
      loadingLabel={<Trans>Ending space…</Trans>}
      successTitle={<Trans>Space ended</Trans>}
      successBody={<Trans>Everyone has been returned to the lobby.</Trans>}
      errorTitle={<Trans>Couldn't end space</Trans>}
      stackId="end-space-confirm"
      submitDataSet={{ testid: Handles.spaceEndConfirm }}
      dismissDataSet={{ testid: Handles.spaceMutationDismiss }}
    />
  );
}
