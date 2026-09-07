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
import type { JSX, ParentProps } from 'solid-js';
import { Show } from 'solid-js';
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

export type SpaceActiveLayoutProps = ParentProps;

/** Title never eats the whole header row; the event log needs its share. */
const WIDE_TITLE_MAX_WIDTH = 280;

function SpaceChromeTitle(props: {
  readonly spaceId: string;
  readonly variant: 'subtitle' | 'navigationTitle';
}): JSX.Element {
  return (
    <Box sx={{ flexShrink: 1, minWidth: 0 }}>
      <SpaceTitleAttribution spaceId={props.spaceId}>
        <SpaceTitleText
          spaceId={props.spaceId}
          variant={props.variant}
          numberOfLines={1}
        />
      </SpaceTitleAttribution>
    </Box>
  );
}

/**
 * Space ActionBar owns a real width budget (a content-sized slot collapses
 * every action into a lone More menu), then the global avatar menu sits at
 * the far edge — same on wide island trailing and compact TopBar trailing.
 */
function SpaceTrailingWithGlobal(): JSX.Element {
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
      {globalTrailing()}
    </Box>
  );
}

function SpaceHeaderEventLog(props: { readonly spaceId: string }): JSX.Element {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <SpaceEventLogChrome spaceId={props.spaceId} />
    </Box>
  );
}

/**
 * Wide body: game canvas, plus optional extras rail (games chrome via
 * {@link SpaceSideRailExtras}). Event log lives in the header island.
 */
function SpaceActiveWideBody(props: ParentProps): JSX.Element {
  const extras = useSpaceSideRailExtras();
  return (
    <Show
      when={extras() !== null}
      fallback={
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{props.children}</Box>
      }
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: ISLAND_GAP_STEP,
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{props.children}</Box>
        <Island sx={{ width: ISLAND_SIDE_RAIL_WIDTH, minHeight: 0, p: 0 }}>
          <Box sx={{ flex: 1, minHeight: 0 }}>{extras()}</Box>
        </Island>
      </Box>
    </Show>
  );
}

function SpaceActiveLayoutWide(props: {
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
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
                <SpaceChromeTitle spaceId={props.spaceId} variant="subtitle" />
              </Box>
              <SpaceHeaderEventLog spaceId={props.spaceId} />
            </Box>
          }
          trailing={<SpaceTrailingWithGlobal />}
        />
        <SpaceActiveWideBody>{props.children}</SpaceActiveWideBody>
      </Box>
    </SpaceSideRailProvider>
  );
}

function SpaceActiveLayoutCompact(props: {
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
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
            <SpaceChromeTitle
              spaceId={props.spaceId}
              variant="navigationTitle"
            />
            <SpaceHeaderEventLog spaceId={props.spaceId} />
          </Box>
        }
        trailing={<SpaceTrailingWithGlobal />}
      />
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{props.children}</Box>
    </Box>
  );
}

/** Mounted only while wide: hides the default tab island. */
function HideAppFrameHeaderWhileWide(): null {
  useSetAppFrameHeader(false);
  return null;
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
export function SpaceActiveLayout(props: SpaceActiveLayoutProps): JSX.Element {
  const sessionUi = useSpaceSessionUi();
  const mode = useLayoutMode();

  return (
    <>
      <Show when={mode() === 'wide'}>
        <HideAppFrameHeaderWhileWide />
      </Show>
      <Show
        when={mode() === 'wide'}
        fallback={
          <SpaceActiveLayoutCompact spaceId={sessionUi.spaceId}>
            {props.children}
          </SpaceActiveLayoutCompact>
        }
      >
        <SpaceActiveLayoutWide spaceId={sessionUi.spaceId}>
          {props.children}
        </SpaceActiveLayoutWide>
      </Show>
    </>
  );
}
