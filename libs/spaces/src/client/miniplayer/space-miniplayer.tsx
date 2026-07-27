import { useRequestEndSpace } from '../end-space/end-space-modal-provider';
import { useRequestLeaveSpace } from '../leave-space/leave-space-modal-provider';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { Box } from '@pkgs/ui';
import { useCallback, useState, type ReactNode } from 'react';

import { useSpaceVisibleProfilesSubscription } from '../use-space-visible-profiles-subscription';
import { ActiveSpacesSheet } from './active-spaces-sheet';
import { MiniplayerStackedBar } from './miniplayer-stacked-bar';
import { resolveMiniplayerMode } from './space-miniplayer-layout';
import { SpaceMiniplayerCard } from './space-miniplayer-card';
import { useSpaceMiniplayerVisibleSpaceIds } from './use-space-miniplayer-visible-space-ids';

export function SpaceMiniplayer(): ReactNode {
  const paintReady = useSyncEnginePaintReady();
  useSpaceVisibleProfilesSubscription();
  const spaceIds = useSpaceMiniplayerVisibleSpaceIds();
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const requestEndSpace = useRequestEndSpace();
  const requestLeaveSpace = useRequestLeaveSpace();
  const mode = resolveMiniplayerMode(spaceIds);
  if (!paintReady || mode.mode === 'hidden') return null;

  const sheet = (
    <ActiveSpacesSheet
      spaceIds={spaceIds}
      visible={sheetOpen}
      onClose={closeSheet}
      requestEndSpace={requestEndSpace}
      requestLeaveSpace={requestLeaveSpace}
    />
  );

  if (mode.mode === 'single') {
    return (
      <Box>
        <SpaceMiniplayerCard
          spaceId={mode.primarySpaceId}
          requestEndSpace={requestEndSpace}
          requestLeaveSpace={requestLeaveSpace}
        />
        {sheet}
      </Box>
    );
  }

  return (
    <Box>
      <MiniplayerStackedBar
        spaceIds={mode.spaceIds}
        onPressOpenPicker={openSheet}
      />
      {sheet}
    </Box>
  );
}
