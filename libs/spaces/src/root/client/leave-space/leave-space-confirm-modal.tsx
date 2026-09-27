import { Handles } from '@libs/test-ids';
import { Trans } from '@lingui/solid/macro';
import { Sounds } from '@pkgs/sounds';
import { useOptionalSoundEngine } from '@pkgs/sounds/solid';
import { MutationModal, type MutationStateTransition } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

export type LeaveSpaceConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Runs the leave-membership write. Surfaces loading / success / error in place. */
  operation: () => Promise<void>;
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: (() => void) | undefined;
  /** Host leave ends the space for everyone (I4); the copy says so. */
  asHost?: boolean;
};

/** Confirm-leave shell (space-agnostic; action wiring lives at the call site). */
export function LeaveSpaceConfirmModal(
  props: LeaveSpaceConfirmModalProps
): JSX.Element {
  const engine = useOptionalSoundEngine();
  const onPhaseChange = (transition: MutationStateTransition): void => {
    const current = engine?.();
    if (current === undefined) return;
    if (transition.to === 'success') {
      current.play(Sounds.social.roomLeft);
    } else if (transition.to === 'error') {
      current.play(Sounds.feedback.error);
    }
  };
  const onSuccess = (): void => {
    props.onSuccess?.();
  };
  return (
    <Show
      when={props.asHost ?? false}
      fallback={
        <MutationModal
          visible={props.visible}
          onClose={props.onClose}
          title={<Trans>Leave space?</Trans>}
          message={
            <Trans>
              Leave this space on your account. You will leave on every device.
              You can join again later if the space is still live.
            </Trans>
          }
          submitLabel={<Trans>Leave</Trans>}
          operation={() => props.operation()}
          onSuccess={onSuccess}
          onPhaseChange={onPhaseChange}
          loadingLabel={<Trans>Leaving…</Trans>}
          successTitle={<Trans>You left the space</Trans>}
          successBody={
            <Trans>
              You can rejoin from the invite link if the space is still live.
            </Trans>
          }
          errorTitle={<Trans>Couldn't leave space</Trans>}
          stackId="leave-space-confirm"
          submitDataSet={{ testid: Handles.spaceLeaveConfirm }}
          dismissDataSet={{ testid: Handles.spaceMutationDismiss }}
        />
      }
    >
      <MutationModal
        visible={props.visible}
        onClose={props.onClose}
        title={<Trans>Leave and end the space?</Trans>}
        message={
          <Trans>
            You're the host, so leaving ends the space for everyone. This cannot
            be undone.
          </Trans>
        }
        submitLabel={<Trans>Leave and end</Trans>}
        variant="destructive"
        operation={() => props.operation()}
        onSuccess={onSuccess}
        onPhaseChange={onPhaseChange}
        loadingLabel={<Trans>Ending space…</Trans>}
        successTitle={<Trans>Space ended</Trans>}
        successBody={<Trans>Everyone has been returned to the lobby.</Trans>}
        errorTitle={<Trans>Couldn't end space</Trans>}
        stackId="leave-space-confirm-as-host"
        submitDataSet={{ testid: Handles.spaceLeaveConfirm }}
        dismissDataSet={{ testid: Handles.spaceMutationDismiss }}
      />
    </Show>
  );
}
