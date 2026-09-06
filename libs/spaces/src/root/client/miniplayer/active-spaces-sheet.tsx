import { Trans } from '@lingui/react/macro';
import { ResponsiveSurface, ScrollView } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import type { RequestEndSpaceOptions } from '../end-space/end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from '../leave-space/leave-space-modal-provider';

import { ActiveSpaceSheetRow } from './active-space-sheet-row';

export type ActiveSpacesSheetProps = {
  spaceIds: readonly string[];
  visible: boolean;
  onClose: () => void;
  requestEndSpace: (spaceId: string, options?: RequestEndSpaceOptions) => void;
  requestLeaveSpace: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
};

/**
 * Lists every live space the user is in. Bottom sheet on mobile, centered
 * modal on wider viewports. End/Leave requestors are injected from outside
 * the portal so `@gorhom/bottom-sheet` does not drop modal context.
 */
export function ActiveSpacesSheet({
  spaceIds,
  visible,
  onClose,
  requestEndSpace,
  requestLeaveSpace,
}: ActiveSpacesSheetProps): ReactNode {
  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={<Trans>Your live spaces</Trans>}
      stackId="active-spaces-sheet"
    >
      <ScrollView frameSx={{ maxHeight: 420 }} sx={{ px: 0 }}>
        {spaceIds.map((spaceId) => (
          <ActiveSpaceSheetRow
            key={spaceId}
            spaceId={spaceId}
            onOpen={onClose}
            requestEndSpace={requestEndSpace}
            requestLeaveSpace={requestLeaveSpace}
          />
        ))}
      </ScrollView>
    </ResponsiveSurface>
  );
}
