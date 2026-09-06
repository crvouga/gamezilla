import {
  AppHeaderIsland,
  Box,
  ISLAND_GAP_STEP,
  ISLAND_SIDE_RAIL_WIDTH,
  Island,
  TopBar,
  useAppFrameGlobalTrailing,
  useLayoutMode,
  useSetAppFrameHeader,
} from '@pkgs/ui';
import type { ReactNode } from 'react';
import {
  SpaceSideRailProvider,
  useSpaceSideRailExtras,
} from '../../../public/space-event-log-placement';
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

/** Title never eats the whole header row; the event log needs its share. */
const WIDE_TITLE_MAX_WIDTH = 280;

function SpaceChromeTitle({
  spaceId,
  variant,
}: {
  spaceId: string;
  variant: 'subtitle' | 'navigationTitle';
}): ReactNode {
  return (
    <Box sx={{ flexShrink: 1, minWidth: 0 }}>
      <SpaceTitleAttribution spaceId={spaceId}>
        <SpaceTitleText spaceId={spaceId} variant={variant} numberOfLines={1} />
      </SpaceTitleAttribution>
    </Box>
  );
}

/**
 * Space ActionBar owns a real width budget (a content-sized slot collapses
 * every action into a lone More menu), then the global avatar menu sits at
 * the far edge — same on wide island trailing and compact TopBar trailing.
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

function SpaceHeaderEventLog({ spaceId }: { spaceId: string }): ReactNode {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <SpaceEventLogChrome spaceId={spaceId} />
    </Box>
  );
}

/**
 * Wide body: game canvas, plus optional extras rail (games chrome via
 * {@link SpaceSideRailExtras}). Event log lives in the header island.
 */
function SpaceActiveWideBody({ children }: { children: ReactNode }): ReactNode {
  const extras = useSpaceSideRailExtras();
  if (extras === null) {
    return <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>;
  }
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: ISLAND_GAP_STEP,
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
      <Island sx={{ width: ISLAND_SIDE_RAIL_WIDTH, minHeight: 0, p: 0 }}>
        <Box sx={{ flex: 1, minHeight: 0 }}>{extras}</Box>
      </Island>
    </Box>
  );
}

function SpaceActiveLayoutWide({
  spaceId,
  children,
}: SpaceActiveLayoutProps & { spaceId: string }): ReactNode {
  return (
    <SpaceSideRailProvider>
      <Box sx={{ flex: 1, minHeight: 0, gap: ISLAND_GAP_STEP }}>
        <AppHeaderIsland
          leading={
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <SpaceChromeLeadingActionBar />
              <Box sx={{ maxWidth: WIDE_TITLE_MAX_WIDTH, minWidth: 0 }}>
                <SpaceChromeTitle spaceId={spaceId} variant="subtitle" />
              </Box>
              <SpaceHeaderEventLog spaceId={spaceId} />
            </Box>
          }
          trailing={<SpaceTrailingWithGlobal />}
        />
        <SpaceActiveWideBody>{children}</SpaceActiveWideBody>
      </Box>
    </SpaceSideRailProvider>
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
        center={
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <SpaceChromeTitle spaceId={spaceId} variant="navigationTitle" />
            <SpaceHeaderEventLog spaceId={spaceId} />
          </Box>
        }
        trailing={<SpaceTrailingWithGlobal />}
      />
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

/**
 * Unified active-space chrome: exit + back, event log, members / manage
 * actions, then the game body.
 *
 * Wide: suppress the AppFrame tab island and paint space chrome as the single
 * top island (nav · title · event log · actions · avatar); body is the game
 * canvas plus an optional extras rail.
 * Compact: TopBar nests the same chrome (nav · title · event log · actions ·
 * avatar), then the full-bleed body.
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
