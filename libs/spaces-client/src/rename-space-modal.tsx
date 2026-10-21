import { useModeration } from '@libs/moderation-client/moderation-context';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { P } from '@pkgs/ui-root-client/text';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  Show,
} from 'solid-js';
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
  const moderation = useModeration();
  const [value, setValue] = createSignal<string>('');

  createEffect(() => {
    if (props.visible) {
      setValue(() => persistedTitle() ?? '');
    }
  });

  // As-you-type moderation: the same policy the rename mutation enforces.
  const refused = createMemo(
    () => !moderation().checkWrite('spaceTitle', value().trim()).allowed
  );

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
      submitDisabled={refused()}
      loadingLabel={<Trans>Saving…</Trans>}
      successTitle={<Trans>Space renamed</Trans>}
      errorTitle={<Trans>Couldn't rename space</Trans>}
      stackId="rename-space"
      submitDataSet={{ testid: Handles.spaceRenameConfirm }}
      cancelDataSet={{ testid: Handles.spaceRenameCancel }}
      dismissDataSet={{ testid: Handles.spaceMutationDismiss }}
    >
      <TextInput
        label={<Trans>Space name</Trans>}
        value={value()}
        onChangeText={(next) => setValue(() => next)}
        invalid={refused()}
        placeholder={t`Give your space a name`}
        autofocus
        autocapitalize="words"
        dataSet={{ testid: Handles.spaceRenameInput }}
      />
      <Show when={refused()}>
        <P
          variant="caption"
          tone="destructive"
          role="alert"
          testId={Handles.spaceRenameNotAllowed}
        >
          <Trans>That space name is not allowed</Trans>
        </P>
      </Show>
    </MutationModal>
  );
}
