import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type {
  MutationStep,
  MutationStepProps,
} from '@pkgs/ui-root-client-ts/mutation-step';
import { useMutationStep } from '@pkgs/ui-root-client-ts/mutation-step';
import { NameText } from '@pkgs/ui-root-client-ts/name-text';

export type RemoveSpacePersonStepProps = {
  /** The shown name of the person being removed. */
  readonly name: string;
  /** Ends the confirm (Cancel, Close while pending, Done). */
  readonly onClose: () => void;
  /** Removes them; the step shows removing / removed / failed in place. */
  readonly operation: () => Promise<void>;
};

/**
 * The host's confirm before removing someone: "Remove person?", the full
 * handle on its own line (breaking only at `_`, `.` or `-`), then removing /
 * removed / failed in place. Getter-backed, so one confirm serves every
 * removal.
 */
export function removeSpacePersonCopy(
  props: RemoveSpacePersonStepProps
): MutationStepProps {
  return {
    onClose: () => props.onClose(),
    get title() {
      return <Trans>Remove person?</Trans>;
    },
    get subject() {
      return <NameText name={props.name} />;
    },
    get message() {
      return (
        <Trans>
          They will leave this space. They can choose to join again through the
          space link.
        </Trans>
      );
    },
    get submitLabel() {
      return <Trans>Remove person</Trans>;
    },
    variant: 'destructive',
    operation: () => props.operation(),
    get loadingLabel() {
      return <Trans>Removing…</Trans>;
    },
    get successTitle() {
      return <Trans>{props.name} removed</Trans>;
    },
    get successBody() {
      return (
        <Trans>
          The space stays open. They can join again through its link.
        </Trans>
      );
    },
    get errorTitle() {
      return <Trans>Couldn't remove person</Trans>;
    },
    submitDataSet: { testid: Handles.spaceRemoveConfirm },
    successDataSet: { testid: Handles.spaceRemoveSuccess },
    dismissDataSet: { testid: Handles.spaceMutationDismiss },
  };
}

/**
 * {@link removeSpacePersonCopy} asked inside the Share dialog: its title
 * becomes "Remove person?" and its body the confirm; closing the step
 * brings the access list back.
 */
export function useRemoveSpacePersonStep(
  props: RemoveSpacePersonStepProps
): MutationStep {
  return useMutationStep(removeSpacePersonCopy(props));
}
