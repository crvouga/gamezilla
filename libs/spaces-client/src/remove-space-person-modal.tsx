import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import type { JSX } from 'solid-js';
import { useRemoveSpaceUser } from './use-remove-space-user';
import type { SpaceUserEntry } from './use-space-user-entries';

export function RemoveSpacePersonModal(props: {
  readonly spaceId: string;
  readonly person: SpaceUserEntry;
  readonly onClose: () => void;
}): JSX.Element {
  const remove = useRemoveSpaceUser();
  return (
    <MutationModal
      visible
      onClose={props.onClose}
      title={<Trans>Remove {props.person.username}?</Trans>}
      message={
        <Trans>
          They will leave this space. They can choose to join again through the
          space link.
        </Trans>
      }
      submitLabel={<Trans>Remove person</Trans>}
      variant="destructive"
      operation={() => remove(props.spaceId, props.person.userId)}
      loadingLabel={<Trans>Removing…</Trans>}
      successTitle={<Trans>{props.person.username} removed</Trans>}
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
