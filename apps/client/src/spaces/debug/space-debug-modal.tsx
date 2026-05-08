/**
 * `SpaceDebugModal` — developer-facing inspector for the space detail screen.
 *
 * Pure layout shell — each section atom renders its own `<JsonView>` subtree.
 */

import { SpaceDebugCurrentSpacesSection } from '@gamezilla/client/spaces/debug/space-debug-current-spaces-section';
import { SpaceDebugMembersSection } from '@gamezilla/client/spaces/debug/space-debug-members-section';
import { SpaceDebugRoomSection } from '@gamezilla/client/spaces/debug/space-debug-room-section';
import { SpaceCounterPanel } from '@gamezilla/client/spaces/layout/space-counter-panel';
import { SpaceDebugRouteSection } from '@gamezilla/client/spaces/debug/space-debug-route-section';
import { SpaceDebugSelfSection } from '@gamezilla/client/spaces/debug/space-debug-self-section';
import { SpaceDebugSpaceSection } from '@gamezilla/client/spaces/debug/space-debug-space-section';
import { Box, ResponsiveSurface } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceDebugModalProps = {
  visible: boolean;
  onClose: () => void;
  spaceId: string;
};

export function SpaceDebugModal({
  visible,
  onClose,
  spaceId,
}: SpaceDebugModalProps): ReactNode {
  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={<Trans>Space debug</Trans>}
      maxWidth={720}
    >
      <Box sx={{ gap: 3 }}>
        <SpaceDebugSelfSection />
        <SpaceDebugRouteSection spaceId={spaceId} />
        <SpaceDebugSpaceSection spaceId={spaceId} />
        <SpaceDebugCurrentSpacesSection />
        <SpaceDebugMembersSection spaceId={spaceId} />
        <SpaceDebugRoomSection />
        <SpaceCounterPanel />
      </Box>
    </ResponsiveSurface>
  );
}
