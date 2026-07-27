import { ResponsiveSurface, ScrollView } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { SpaceMembersList } from '../active-space/space-members-list';

export type SpaceMembersListModalProps = {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
};

/**
 * Modal listing space members. Uses {@link ResponsiveSurface} (bottom sheet on
 * mobile, centered modal on wider viewports).
 */
export function SpaceMembersListModal({
  spaceId,
  visible,
  onClose,
}: SpaceMembersListModalProps): ReactNode {
  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={<Trans>People in this space</Trans>}
    >
      <ScrollView style={{ maxHeight: 420 }} sx={{ px: 0 }}>
        <SpaceMembersList spaceId={spaceId} />
      </ScrollView>
    </ResponsiveSurface>
  );
}
