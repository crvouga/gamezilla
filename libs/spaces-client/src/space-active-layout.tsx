import { Handles } from '@libs/test-ids-shared/handles';
import {
  useAppFrameGlobalTrailing,
  useSetAppFrameHeader,
} from '@pkgs/ui-root-client/app-frame-chrome';
import { AppHeaderIsland } from '@pkgs/ui-root-client/app-header-island';
import { ChromeTitle } from '@pkgs/ui-root-client/chrome-title';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import { TopBar } from '@pkgs/ui-root-client/top-bar';
import { useLayoutMode } from '@pkgs/ui-root-client/use-layout-mode';
import type { JSX, ParentProps } from 'solid-js';
import { Show } from 'solid-js';
import {
  SpaceChromeLeadingActionBar,
  SpaceChromeTrailingActionBar,
} from './space-chrome-action-bar';
import { SpaceHostConnectionStatus } from './space-host-connection-status';
import { useSpaceSessionUi } from './space-session-ui-context';
import { SpaceTitleText } from './space-title-text';

export type SpaceActiveLayoutProps = ParentProps<{
  readonly hostOffline: boolean;
}>;

function SpaceChromeTitle(props: {
  readonly spaceId: string;
  readonly size: 'subtitle' | 'navigationTitle';
}): JSX.Element {
  return (
    <StackVertical shrink testId={Handles.spaceTitle}>
      <ChromeTitle size={props.size}>
        <SpaceTitleText spaceId={props.spaceId} />
      </ChromeTitle>
    </StackVertical>
  );
}

/**
 * Space actions, the host status, then the global avatar menu at the far
 * edge — same on wide header trailing and compact TopBar trailing. They are
 * the bar's own row items (no wrapper), so the ActionBar sizes itself
 * against the title and collapses into its More menu when the row is short.
 */
function SpaceTrailingWithGlobal(props: {
  readonly hostOffline: boolean;
}): JSX.Element {
  const globalTrailing = useAppFrameGlobalTrailing();
  return (
    <>
      <SpaceChromeTrailingActionBar />
      <SpaceHostConnectionStatus offline={props.hostOffline} />
      {globalTrailing()}
    </>
  );
}

function SpaceActiveLayoutWide(props: {
  readonly hostOffline: boolean;
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    // No clipping here: the header's hairline runs past this column to the
    // viewport edges. The body below clips its own overflow.
    <StackVertical grow gap="sm">
      <AppHeaderIsland
        leading={
          <StackHorizontal grow align="center" gap="lg">
            <SpaceChromeLeadingActionBar />
            <SpaceChromeTitle spaceId={props.spaceId} size="subtitle" />
          </StackHorizontal>
        }
        trailing={<SpaceTrailingWithGlobal hostOffline={props.hostOffline} />}
      />
      <StackVertical grow overflow="hidden">
        {props.children}
      </StackVertical>
    </StackVertical>
  );
}

function SpaceActiveLayoutCompact(props: {
  readonly hostOffline: boolean;
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <StackVertical grow>
      <TopBar
        leading={<SpaceChromeLeadingActionBar />}
        center={
          <SpaceChromeTitle spaceId={props.spaceId} size="navigationTitle" />
        }
        trailing={<SpaceTrailingWithGlobal hostOffline={props.hostOffline} />}
        centerPosition="flex"
      />
      <StackVertical grow overflow="hidden">
        {props.children}
      </StackVertical>
    </StackVertical>
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
          <SpaceActiveLayoutCompact
            spaceId={sessionUi.spaceId}
            hostOffline={props.hostOffline}
          >
            {props.children}
          </SpaceActiveLayoutCompact>
        }
      >
        <SpaceActiveLayoutWide
          spaceId={sessionUi.spaceId}
          hostOffline={props.hostOffline}
        >
          {props.children}
        </SpaceActiveLayoutWide>
      </Show>
    </>
  );
}
