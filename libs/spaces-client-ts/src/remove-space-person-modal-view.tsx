import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { NameText } from '@pkgs/ui-root-client-ts/name-text';
import type { JSX } from '@solidjs/web';

export type RemoveSpacePersonModalViewProps = {
  /** The person's shown name. */
  readonly name: string;
  readonly onClose: () => void;
  /** Removes them; the modal shows removing / removed / failed in place. */
  readonly operation: () => Promise<void>;
};

/**
 * The host's confirm before removing someone from a space. The title stays
 * short; the full handle stands on its own line in the body, breaking only
 * at `_`, `.` or `-`, so a long name never splits mid-word in a heading.
 */
export function RemoveSpacePersonModalView(
  props: RemoveSpacePersonModalViewProps
): JSX.Element {
  return (
    <MutationModal
      visible
      onClose={() => props.onClose()}
      title={<Trans>Remove person?</Trans>}
      subject={<NameText name={props.name} />}
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
