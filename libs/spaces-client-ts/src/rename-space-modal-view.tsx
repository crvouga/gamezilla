import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { type JSX, Show } from 'solid-js';

export type RenameSpaceModalViewProps = {
  readonly visible: boolean;
  /** The name being typed; empty clears the custom title. */
  readonly value: string;
  /** The moderation policy refuses this name; Save is off. */
  readonly refused: boolean;
  readonly onChangeValue: (value: string) => void;
  readonly onClose: () => void;
  /** Saves the name; the modal shows saving / saved / failed in place. */
  readonly operation: () => Promise<void>;
};

/** The host's rename for a space, refusing a disallowed name as it is typed. */
export function RenameSpaceModalView(
  props: RenameSpaceModalViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <MutationModal
      visible={props.visible}
      onClose={() => props.onClose()}
      title={<Trans>Rename space</Trans>}
      submitLabel={<Trans>Save</Trans>}
      operation={() => props.operation()}
      submitDisabled={props.refused}
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
        value={props.value}
        onChangeText={(next) => props.onChangeValue(next)}
        invalid={props.refused}
        placeholder={t`Give your space a name`}
        autofocus
        autocapitalize="words"
        dataSet={{ testid: Handles.spaceRenameInput }}
      />
      <Show when={props.refused}>
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
