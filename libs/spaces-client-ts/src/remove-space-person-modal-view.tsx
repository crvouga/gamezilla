import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import type { JSX } from 'solid-js';

export type RemoveSpacePersonModalViewProps = {
  /** The person's shown name. */
  readonly name: string;
  readonly onClose: () => void;
  /** Removes them; the modal shows removing / removed / failed in place. */
  readonly operation: () => Promise<void>;
};

/** The host's confirm before removing someone from a space. */
export function RemoveSpacePersonModalView(
  props: RemoveSpacePersonModalViewProps
): JSX.Element {
  return (
    <MutationModal
      visible
      onClose={() => props.onClose()}
      title={<Trans>Remove {props.name}?</Trans>}
      message={
        <Trans>
          They will leave this space. They can choose to join again through the
          space link.
        </Trans>
      }
      submitLabel={<Trans>Remove person</Trans>}
      variant="destructive"
      operation={() => props.operation()}
      loadingLabel={<Trans>Removing…</Trans>}
      successTitle={<Trans>{props.name} removed</Trans>}
      successBody={
        <Trans>
          The space stays open. They can join again through its link.
        </Trans>
      }
      errorTitle={<Trans>Couldn't remove person</Trans>}
      stackId="remove-space-person"
      submitDataSet={{ testid: Handles.spaceRemoveConfirm }}
      successDataSet={{ testid: Handles.spaceRemoveSuccess }}
      dismissDataSet={{ testid: Handles.spaceMutationDismiss }}
    />
  );
}
