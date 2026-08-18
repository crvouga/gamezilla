import { Trans, useLingui } from '@lingui/react/macro';
import { MutationModal, TextInput } from '@pkgs/ui';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { SpaceField, useSpaceColumn } from '../use-space-column';
import { useRenameSpace } from './use-rename-space';

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
export function RenameSpaceModal({
  spaceId,
  visible,
  onClose,
}: RenameSpaceModalProps): ReactNode {
  const { t } = useLingui();
  const persistedTitle = useSpaceColumn(spaceId, SpaceField.title);
  const renameSpace = useRenameSpace();
  const [value, setValue] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setValue(persistedTitle ?? '');
    }
  }, [visible, persistedTitle]);

  const operation = useCallback(
    () => renameSpace(spaceId, value),
    [renameSpace, spaceId, value]
  );

  return (
    <MutationModal
      visible={visible}
      onClose={onClose}
      title={<Trans>Rename space</Trans>}
      submitLabel={<Trans>Save</Trans>}
      operation={operation}
      loadingLabel={<Trans>Saving…</Trans>}
      successTitle={<Trans>Space renamed</Trans>}
      errorTitle={<Trans>Couldn't rename space</Trans>}
    >
      <TextInput
        label={<Trans>Space name</Trans>}
        value={value}
        onChangeText={setValue}
        placeholder={t`Give your space a name`}
        autoFocus
        autoCapitalize="words"
        autoCorrect
      />
    </MutationModal>
  );
}
