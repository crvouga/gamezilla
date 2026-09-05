import {
  AppHeaderIsland,
  Box,
  Card,
  ISLAND_GAP_STEP,
  Island,
  TopBar,
  useAppFrameGlobalTrailing,
  useLayoutMode,
  useSetAppFrameHeader,
} from '@pkgs/ui';
import type { ReactNode } from 'react';
import { SpaceTitleText } from '../space-title-text';
import {
  SpaceChromeLeadingActionBar,
  SpaceChromeTrailingActionBar,
} from './space-chrome-action-bar';
import { SpaceEventLogChrome } from './space-event-log-chrome';
import { useSpaceSessionUi } from './space-session-ui-context';
import { SpaceTitleAttribution } from './space-title-attribution';

export type SpaceActiveLayoutProps = {
  children: ReactNode;
};

/** Horizontal step for compact chrome (matches TopBar's `px`). */
const COMPACT_EDGE_STEP = 3;

function SpaceChromeTitle({ spaceId }: { spaceId: string }): ReactNode {
  return (
    <Box sx={{ flexShrink: 1, minWidth: 0 }}>
      <SpaceTitleAttribution spaceId={spaceId}>
        <SpaceTitleText
          spaceId={spaceId}
          variant="subtitle"
          numberOfLines={1}
        />
      </SpaceTitleAttribution>
    </Box>
  );
}

/**
 * Wide trailing: the space ActionBar must own a real width budget (a
 * content-sized slot collapses every action into a lone More menu), then the
 * global avatar menu sits at the far edge like on the tab island it replaces.
 */
function SpaceTrailingWithGlobal(): ReactNode {
  const globalTrailing = useAppFrameGlobalTrailing();
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <SpaceChromeTrailingActionBar />
      </Box>
      {globalTrailing}
    </Box>
  );
}

function SpaceActiveLayoutWide({
  spaceId,
  children,
}: SpaceActiveLayoutProps & { spaceId: string }): ReactNode {
  return (
    <Box sx={{ flex: 1, minHeight: 0, gap: ISLAND_GAP_STEP }}>
      <AppHeaderIsland
        leading={
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <SpaceChromeLeadingActionBar />
            <SpaceChromeTitle spaceId={spaceId} />
          </Box>
        }
        trailing={<SpaceTrailingWithGlobal />}
      />
      <Island sx={{ p: 0 }}>
        <SpaceEventLogChrome spaceId={spaceId} />
      </Island>
      {/* Games paint their own islands — never a card inside a card. */}
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

function SpaceActiveLayoutCompact({
  spaceId,
  children,
}: SpaceActiveLayoutProps & { spaceId: string }): ReactNode {
  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <TopBar
        leading={<SpaceChromeLeadingActionBar />}
        center={<SpaceChromeTitle spaceId={spaceId} />}
        trailing={<SpaceChromeTrailingActionBar />}
      />
      <Box sx={{ px: COMPACT_EDGE_STEP, pt: 2 }}>
        <Card sx={{ p: 0, overflow: 'hidden' }}>
          <SpaceEventLogChrome spaceId={spaceId} />
        </Card>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

/**
 * Unified active-space chrome: exit + back, space title, members / manage
 * actions, then the events card, then the game body.
 *
 * Wide: suppress the AppFrame tab island and paint space chrome as the single
 * top island (in-tree so session context stays valid); events get their own
 * island and the body is an open canvas the game fills with islands.
 * Compact: TopBar (no global avatar — the space is a modal over the tabs,
 * which own it), events card, full-bleed body.
 */
export function SpaceActiveLayout({
  children,
}: SpaceActiveLayoutProps): ReactNode {
  const { spaceId } = useSpaceSessionUi();
  const mode = useLayoutMode();
  // Hide default tab island while this space owns the top chrome.
  useSetAppFrameHeader(mode === 'wide' ? false : null);

  if (mode === 'wide') {
    return (
      <SpaceActiveLayoutWide spaceId={spaceId}>
        {children}
      </SpaceActiveLayoutWide>
    );
  }
  return (
    <SpaceActiveLayoutCompact spaceId={spaceId}>
      {children}
    </SpaceActiveLayoutCompact>
  );
}
