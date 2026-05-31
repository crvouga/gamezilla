import { MutationModal, TextInput } from '@pkgs/ui';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@libs/spaces/shared/space-entities';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { useSpaceActions } from '../lifecycle/space-actions';

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
  const persistedTitle = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.title,
  });
  const { renameSpace } = useSpaceActions();
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
