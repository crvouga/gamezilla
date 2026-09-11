import {
  AppHeaderIsland,
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
import { useSpaceSessionUi } from './space-session-ui-context';

export type SpaceActiveLayoutProps = ParentProps;

function SpaceChromeTitle(props: {
  readonly spaceId: string;
  readonly variant: 'subtitle' | 'navigationTitle';
}): JSX.Element {
  return (
    <div class="box shrink min-w-[0]">
      <SpaceTitleText
        spaceId={props.spaceId}
        variant={props.variant}
        numberOfLines={1}
      />
    </div>
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
    <div class="box flex-1 min-w-[0] flex-row items-center gap-2">
      <div class="box flex-1 min-w-[0]">
        <SpaceChromeTrailingActionBar />
      </div>
      {globalTrailing()}
    </div>
  );
}

/**
 * Wide body: game canvas, plus optional extras rail (game chrome via
 * {@link SpaceSideRailExtras}).
 */
function SpaceActiveWideBody(props: ParentProps): JSX.Element {
  const extras = useSpaceSideRailExtras();
  return (
    <Show
      when={extras() !== null}
      fallback={
        <div class="box flex-1 min-h-[0] min-w-[0]">{props.children}</div>
      }
    >
      <div
        class="box flex-1 min-h-[0] flex-row items-stretch"
        style={{ gap: `${ISLAND_GAP_STEP * 4}px` }}
      >
        <div class="box flex-1 min-h-[0] min-w-[0]">{props.children}</div>
        <Island
          class="min-h-[0] p-0"
          style={{ width: `${ISLAND_SIDE_RAIL_WIDTH}px` }}
        >
          <div class="box flex-1 min-h-[0]">{extras()}</div>
        </Island>
      </div>
    </Show>
  );
}

function SpaceActiveLayoutWide(props: {
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <SpaceSideRailProvider>
      <div
        class="box flex-1 min-h-[0]"
        style={{ gap: `${ISLAND_GAP_STEP * 4}px` }}
      >
        <AppHeaderIsland
          leading={
            <div class="box flex-1 min-w-[0] flex-row items-center gap-4">
              <SpaceChromeLeadingActionBar />
              <SpaceChromeTitle spaceId={props.spaceId} variant="subtitle" />
            </div>
          }
          trailing={<SpaceTrailingWithGlobal />}
        />
        <SpaceActiveWideBody>{props.children}</SpaceActiveWideBody>
      </div>
    </SpaceSideRailProvider>
  );
}

function SpaceActiveLayoutCompact(props: {
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <div class="box flex-1 min-h-[0]">
      <TopBar
        leading={<SpaceChromeLeadingActionBar />}
        center={
          <SpaceChromeTitle spaceId={props.spaceId} variant="navigationTitle" />
        }
        trailing={<SpaceTrailingWithGlobal />}
        centerPosition="flex"
      />
      <div class="box flex-1 min-h-[0] min-w-[0] overflow-hidden">
        {props.children}
      </div>
    </div>
  );
}

/** Mounted only while wide: hides the default tab island. */
function HideAppFrameHeaderWhileWide(): null {
  useSetAppFrameHeader(false);
  return null;
}

/**
 * Unified active-space chrome: exit + back, members / manage actions, then
 * the game body.
 *
 * Wide: suppress the AppFrame tab island and paint space chrome as the single
 * top island (nav · title · actions · avatar); body is the game canvas plus an
 * optional extras rail.
 * Compact: TopBar nests the same chrome (nav · title · actions · avatar), then
 * the full-bleed body.
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
