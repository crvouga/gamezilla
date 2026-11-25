import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

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
      {/* The field and what is said about it, a breath apart. */}
      <StackVertical gap="sm">
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
        <Show when={!props.refused && props.value.trim() === ''}>
          <P variant="caption" tone="secondary">
            <Trans>Leave it empty to name the space after its host.</Trans>
          </P>
        </Show>
        <Show when={props.refused}>
          <P
            variant="caption"
            tone="destructive"
            role="alert"
            testId={Handles.spaceRenameNotAllowed}
          >
            <Trans>That name isn't allowed. Try a different one.</Trans>
          </P>
        </Show>
      </StackVertical>
    </MutationModal>
  );
}
