import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { Box } from '@pkgs/ui';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useRequestEndSpace } from '../end-space/end-space-modal-provider';
import { useRequestLeaveSpace } from '../leave-space/leave-space-modal-provider';

import { ActiveSpacesSheet } from './active-spaces-sheet';
import { MiniplayerStackedBar } from './miniplayer-stacked-bar';
import { SpaceMiniplayerCard } from './space-miniplayer-card';
import { resolveMiniplayerMode } from './space-miniplayer-layout';
import { useSpaceMiniplayerVisibleSpaceIds } from './use-space-miniplayer-visible-space-ids';

export function SpaceMiniplayer(): ReactNode {
  const paintReady = useSyncEnginePaintReady();
  const spaceIds = useSpaceMiniplayerVisibleSpaceIds();
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const requestEndSpace = useRequestEndSpace();
  const requestLeaveSpace = useRequestLeaveSpace();
  const mode = resolveMiniplayerMode(spaceIds);

  // Sheet is only opened from the stacked bar. Clear it when we leave stack
  // mode (including a brief hidden gap after ending all spaces) so a later
  // single-space remount does not reopen it.
  useEffect(() => {
    if (mode.mode !== 'stack') setSheetOpen(false);
  }, [mode.mode]);

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
