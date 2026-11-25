import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { useOptionalSoundEngine } from '@pkgs/sounds-client-ts/solid';
import { Sounds } from '@pkgs/sounds-shared-ts/sound-id';
import type { MutationStateTransition } from '@pkgs/ui-root-client-ts/mutation-lifecycle';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import type { JSX } from '@solidjs/web';
import { createEffect, createSignal, Show, untrack } from 'solid-js';

export type LeaveSpaceConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Runs the leave-membership write. Surfaces loading / success / error in place. */
  operation: () => Promise<void>;
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: (() => void) | undefined;
  /** Host leave ends the space for everyone (I4); the copy says so. */
  asHost?: boolean;
  /** The space's name, so the question says which space it is about. */
  spaceName?: string | undefined;
};

/** The question, naming the space when its name is known. */
function LeaveSpaceTitle(props: {
  readonly asHost: boolean;
  readonly spaceName: string | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.asHost}
      fallback={
        <Show
          when={props.spaceName}
          fallback={<Trans>Leave this space?</Trans>}
        >
          {(name) => <Trans>Leave {name()}?</Trans>}
        </Show>
      }
    >
      <Show when={props.spaceName} fallback={<Trans>End this space?</Trans>}>
        {(name) => <Trans>End {name()}?</Trans>}
      </Show>
    </Show>
  );
}

/** Confirm-leave shell (space-agnostic; action wiring lives at the call site). */
export function LeaveSpaceConfirmModal(
  props: LeaveSpaceConfirmModalProps
): JSX.Element {
  const engine = useOptionalSoundEngine();
  const [confirmedAsHost, setConfirmedAsHost] = createSignal<boolean>();
  createEffect(
    () => props.visible,
    (visible) => {
      if (!visible) setConfirmedAsHost(undefined);
    }
  );
  const operation = (): Promise<void> => {
    setConfirmedAsHost(props.asHost ?? false);
    return props.operation();
  };
  const onPhaseChange = (transition: MutationStateTransition): void => {
    // The phase change is the event: the engine is looked up once, when it
    // arrives.
    const current = untrack(() => engine?.());
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
  const asHost = () => confirmedAsHost() ?? props.asHost ?? false;
  return (
    <MutationModal
      visible={props.visible}
      onClose={props.onClose}
      title={<LeaveSpaceTitle asHost={asHost()} spaceName={props.spaceName} />}
      message={
        asHost() ? (
          <Trans>
            Everyone in it leaves and the space closes for good. This can't be
            undone.
          </Trans>
        ) : (
          <Trans>
            You'll leave on all your devices. You can join again while the space
            is live.
          </Trans>
        )
      }
      submitLabel={
        asHost() ? <Trans>End space</Trans> : <Trans>Leave space</Trans>
      }
      variant="destructive"
      operation={operation}
      onSuccess={onSuccess}
      onPhaseChange={onPhaseChange}
      loadingLabel={
        asHost() ? <Trans>Ending space…</Trans> : <Trans>Leaving…</Trans>
      }
      successTitle={
        asHost() ? (
          <Trans>Space ended</Trans>
        ) : (
          <Trans>You left the space</Trans>
        )
      }
      successBody={
        asHost() ? (
          <Trans>Everyone in it is back in Spaces.</Trans>
        ) : (
          <Trans>
            You can join again from Spaces or the link while it's live.
          </Trans>
        )
      }
      errorTitle={
        asHost() ? (
          <Trans>Couldn't end space</Trans>
        ) : (
          <Trans>Couldn't leave space</Trans>
        )
      }
      stackId="leave-space-confirm"
      submitDataSet={{ testid: Handles.spaceLeaveConfirm }}
      dismissDataSet={{ testid: Handles.spaceMutationDismiss }}
    />
  );
}
