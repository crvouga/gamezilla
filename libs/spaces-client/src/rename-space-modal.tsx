import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { createEffect, createSignal, type JSX } from 'solid-js';
import { useRenameSpace } from './use-rename-space';
import { SpaceField, useSpaceColumn } from './use-space-column';

export type RenameSpaceModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * Host-only modal for editing {@link SpaceAttr.title}. Prefills the input
 * with the persisted custom title (no fallback to the host-name template
 * so an empty input means "clear the custom title"). Submitting runs the
 * rename through the shared mutation lifecycle (loading -> success / error).
 */
export function RenameSpaceModal(props: RenameSpaceModalProps): JSX.Element {
  const { t } = useLingui();
  const persistedTitle = useSpaceColumn(() => props.spaceId, SpaceField.title);
  const renameSpace = useRenameSpace();
  const [value, setValue] = createSignal<string>('');

  createEffect(() => {
    if (props.visible) {
      setValue(() => persistedTitle() ?? '');
    }
  });

  const operation = async (): Promise<void> => {
    await renameSpace(props.spaceId, value());
  };

  return (
    <MutationModal
      visible={props.visible}
      onClose={props.onClose}
      title={<Trans>Rename space</Trans>}
      submitLabel={<Trans>Save</Trans>}
      operation={operation}
      loadingLabel={<Trans>Saving…</Trans>}
      successTitle={<Trans>Space renamed</Trans>}
      errorTitle={<Trans>Couldn't rename space</Trans>}
      stackId="rename-space"
      submitDataSet={{ testid: Handles.spaceRenameConfirm }}
      dismissDataSet={{ testid: Handles.spaceMutationDismiss }}
    >
      <TextInput
        label={<Trans>Space name</Trans>}
        value={value()}
        onChangeText={(next) => setValue(() => next)}
        placeholder={t`Give your space a name`}
        autofocus
        autocapitalize="words"
        dataSet={{ testid: Handles.spaceRenameInput }}
      />
    </MutationModal>
  );
}
