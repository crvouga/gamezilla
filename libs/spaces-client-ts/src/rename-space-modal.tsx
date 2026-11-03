import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { createEffect, createMemo, createSignal, type JSX } from 'solid-js';
import { RenameSpaceModalView } from './rename-space-modal-view';
import { useRenameSpace } from './use-rename-space';
import { SpaceField, useSpaceColumn } from './use-space-column';

export type RenameSpaceModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * Wires {@link RenameSpaceModalView} to the space's title. Opening prefills
 * the persisted custom title (no host-name fallback, so an empty input means
 * "clear the custom title"); the name is checked as typed against the same
 * policy the rename mutation enforces.
 */
export function RenameSpaceModal(props: RenameSpaceModalProps): JSX.Element {
  const persistedTitle = useSpaceColumn(() => props.spaceId, SpaceField.title);
  const renameSpace = useRenameSpace();
  const moderation = useModeration();
  const [value, setValue] = createSignal<string>('');

  createEffect(() => {
    if (props.visible) {
      setValue(() => persistedTitle() ?? '');
    }
  });

  const refused = createMemo(
    () => !moderation().checkWrite('spaceTitle', value().trim()).allowed
  );

  return (
    <RenameSpaceModalView
      visible={props.visible}
      value={value()}
      refused={refused()}
      onChangeValue={(next) => setValue(() => next)}
      onClose={props.onClose}
      operation={async () => {
        await renameSpace(props.spaceId, value());
      }}
    />
  );
}
