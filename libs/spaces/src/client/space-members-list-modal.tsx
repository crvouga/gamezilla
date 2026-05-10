import { SpaceMembersGuestsBlock } from '@gamezilla/client/spaces/guests/space-members-guests-block';
import { SpaceMembersHostBlock } from '@gamezilla/client/spaces/members/space-members-host-block';
import {
  Box,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalRoot,
  ScrollView,
} from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceMembersListModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/** Modal listing host + guest tiles for a space (id-driven). */
export function SpaceMembersListModal({
  spaceId,
  visible,
  onClose,
}: SpaceMembersListModalProps): ReactNode {
  const { t } = useLingui();

  return (
    <ModalRoot visible={visible} onRequestClose={onClose}>
      <ModalBackdrop onPress={onClose}>
        <ModalContent>
          <ModalHeader title={t`People in this space`} />
          <ScrollView style={{ maxHeight: 420 }}>
            <Box sx={{ gap: 4, paddingBottom: 2 }}>
              <SpaceMembersHostBlock spaceId={spaceId} />
              <SpaceMembersGuestsBlock spaceId={spaceId} />
            </Box>
          </ScrollView>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}
