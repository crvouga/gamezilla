import { useSyncEngine } from '@pkgs/sync-engine/client';
import { Box, ISLAND_GAP_STEP, useLayoutMode } from '@pkgs/ui';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { SPACE_CARD_BORDER_RADIUS } from '../card/space-card-gradient';
import { useRequestEndSpace } from '../end-space/end-space-modal-provider';
import { useRequestLeaveSpace } from '../leave-space/leave-space-modal-provider';

import { ActiveSpacesSheet } from './active-spaces-sheet';
import { MiniplayerStackedBar } from './miniplayer-stacked-bar';
import { SpaceMiniplayerCard } from './space-miniplayer-card';
import {
  type MiniplayerFrame,
  resolveMiniplayerFrame,
  resolveMiniplayerMode,
} from './space-miniplayer-layout';
import { useSpaceMiniplayerVisibleSpaceIds } from './use-space-miniplayer-visible-space-ids';

/**
 * Bottom-pinned frame: compact spans the tab-bar width edge to edge; wide
 * centers a card no wider than the lobby cards and keeps island spacing above.
 */
function MiniplayerFrameBox({
  frame,
  children,
}: {
  frame: MiniplayerFrame;
  children: ReactNode;
}): ReactNode {
  if (frame.maxWidth === null) {
    return <Box>{children}</Box>;
  }
  return (
    <Box sx={{ alignItems: 'center', pt: ISLAND_GAP_STEP }}>
      <Box sx={{ width: '100%', maxWidth: frame.maxWidth }}>{children}</Box>
    </Box>
  );
}

export function SpaceMiniplayer(): ReactNode {
  const { paintReady } = useSyncEngine();
  const spaceIds = useSpaceMiniplayerVisibleSpaceIds();
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const requestEndSpace = useRequestEndSpace();
  const requestLeaveSpace = useRequestLeaveSpace();
  const mode = resolveMiniplayerMode(spaceIds);
  const frame = resolveMiniplayerFrame(useLayoutMode());
  const borderRadius = frame.rounded ? SPACE_CARD_BORDER_RADIUS : 0;

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
      <MiniplayerFrameBox frame={frame}>
        <SpaceMiniplayerCard
          spaceId={mode.primarySpaceId}
          borderRadius={borderRadius}
          requestEndSpace={requestEndSpace}
          requestLeaveSpace={requestLeaveSpace}
        />
        {sheet}
      </MiniplayerFrameBox>
    );
  }

  return (
    <MiniplayerFrameBox frame={frame}>
      <MiniplayerStackedBar
        spaceIds={mode.spaceIds}
        borderRadius={borderRadius}
        onPressOpenPicker={openSheet}
      />
      {sheet}
    </MiniplayerFrameBox>
  );
}
