import {
  AppHeaderIsland,
  ISLAND_GAP_STEP,
  TopBar,
  useAppFrameGlobalTrailing,
  useLayoutMode,
  useSetAppFrameHeader,
} from '@pkgs/ui';
import type { JSX, ParentProps } from 'solid-js';
import { Show } from 'solid-js';
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
 * the far edge — same on wide header trailing and compact TopBar trailing.
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

function SpaceActiveLayoutWide(props: {
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box flex-1 min-h-[0] min-w-[0] overflow-hidden"
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
      <div class="box flex-1 min-h-[0] min-w-[0] overflow-hidden">
        {props.children}
      </div>
    </div>
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

/** Mounted only while wide: hides the default tab header. */
function HideAppFrameHeaderWhileWide(): null {
  useSetAppFrameHeader(false);
  return null;
}

/**
 * Unified active-space chrome: exit + back, members / manage actions, then
 * the game body.
 *
 * Wide: suppress the AppFrame tab header and paint space chrome as the single
 * top bar (nav · title · actions · avatar); body is a single-column game canvas.
 * Compact: TopBar nests the same chrome, then the full-bleed body.
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
