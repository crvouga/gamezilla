import {
  ModalButton,
  ModalFooter,
  ResponsiveSurface,
  TextInput,
} from '@pkgs/ui';
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
 * so an empty input means "clear the custom title"). Closes on success.
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(persistedTitle ?? '');
    }
  }, [visible, persistedTitle]);

  const onSubmit = useCallback(() => {
    if (submitting) return;
    setSubmitting(true);
    void (async () => {
      try {
        await renameSpace(spaceId, value);
        onClose();
      } finally {
        setSubmitting(false);
      }
    })();
  }, [onClose, renameSpace, spaceId, submitting, value]);

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={submitting ? () => undefined : onClose}
      title={<Trans>Rename space</Trans>}
    >
      <TextInput
        label={<Trans>Space name</Trans>}
        value={value}
        onChangeText={setValue}
        placeholder={t`Give your space a name`}
        autoFocus
        autoCapitalize="words"
        autoCorrect
        editable={!submitting}
        sx={{ mb: 4 }}
      />
      <ModalFooter>
        <ModalButton
          label={<Trans>Cancel</Trans>}
          variant="cancel"
          disabled={submitting}
          onPress={onClose}
        />
        <ModalButton
          label={<Trans>Save</Trans>}
          disabled={submitting}
          onPress={onSubmit}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
