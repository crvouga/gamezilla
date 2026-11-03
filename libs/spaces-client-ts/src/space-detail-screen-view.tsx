import { Handles } from '@libs/test-ids-shared-ts/handles';
import {
  useAppFrameGlobalTrailing,
  useSetAppFrameHeader,
} from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { AppHeaderIsland } from '@pkgs/ui-root-client-ts/app-header-island';
import { ChromeTitle } from '@pkgs/ui-root-client-ts/chrome-title';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { TopBar } from '@pkgs/ui-root-client-ts/top-bar';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import type { SpaceChromeTrailingCallbacks } from './space-chrome-action-bar';
import {
  SpaceChromeLeadingActionBar,
  SpaceChromeTrailingActionBar,
} from './space-chrome-action-bar';
import { SpaceHostConnectionStatus } from './space-host-connection-status';
import { SpacePresenceStripView } from './space-presence-strip-view';

/** The space's body is still being reached, or shows its content. */
export type SpaceDetailStatus = 'loading' | 'ready';

export type SpaceDetailScreenViewProps = SpaceChromeTrailingCallbacks & {
  /** Custom title, or the localized "<host>'s space" fallback. */
  readonly title: string;
  readonly status: SpaceDetailStatus;
  /** A guest's host has gone; shared features wait for them. */
  readonly hostOffline: boolean;
  readonly canRename: boolean;
  /** The host ends the space; everyone else only leaves. */
  readonly canEnd: boolean;
  /** Faces on the members button; the people glyph when omitted. */
  readonly presence?: ((size: number) => JSX.Element) | undefined;
  /** Inline notice for a refused change, under the bar. */
  readonly notice?: JSX.Element;
  /** Sheets and modals the screen owns (members, share, rename). */
  readonly overlays?: JSX.Element;
  /** The body once ready: the games menu or a game. */
  readonly children?: JSX.Element;
};

type LayoutProps = Omit<SpaceDetailScreenViewProps, 'children'> & {
  readonly body: JSX.Element;
};

function SpaceChromeTitle(props: {
  readonly title: string;
  readonly size: 'subtitle' | 'navigationTitle';
}): JSX.Element {
  return (
    <StackVertical shrink testId={Handles.spaceTitle}>
      <ChromeTitle size={props.size}>
        <Text variant="inherit">{props.title}</Text>
      </ChromeTitle>
    </StackVertical>
  );
}

/**
 * Space actions, the host status, then the global avatar menu at the far
 * edge — the bar's own row items (no wrapper), so the ActionBar sizes itself
 * against the title and collapses into its More menu when the row is short.
 */
function SpaceTrailing(props: LayoutProps): JSX.Element {
  const globalTrailing = useAppFrameGlobalTrailing();
  return (
    <>
      <SpaceChromeTrailingActionBar
        canRename={props.canRename}
        canEnd={props.canEnd}
        presence={(size) =>
          props.presence?.(size) ?? (
            <SpacePresenceStripView faces={[]} size={size} />
          )
        }
        callbacks={props}
      />
      <SpaceHostConnectionStatus offline={props.hostOffline} />
      {globalTrailing()}
    </>
  );
}

function SpaceLayoutWide(props: LayoutProps): JSX.Element {
  return (
    // No clipping here: the header's hairline runs past this column to the
    // viewport edges. The body below clips its own overflow.
    <StackVertical grow gap="sm">
      <AppHeaderIsland
        leading={
          <StackHorizontal grow align="center" gap="lg">
            <SpaceChromeLeadingActionBar
              onPressHome={props.onPressHome}
              onPressBack={props.onPressBack}
            />
            <SpaceChromeTitle title={props.title} size="subtitle" />
          </StackHorizontal>
        }
        trailing={<SpaceTrailing {...props} />}
      />
      {props.notice}
      <StackVertical grow overflow="hidden">
        {props.body}
      </StackVertical>
    </StackVertical>
  );
}

function SpaceLayoutCompact(props: LayoutProps): JSX.Element {
  return (
    <StackVertical grow>
      <TopBar
        leading={
          <SpaceChromeLeadingActionBar
            onPressHome={props.onPressHome}
            onPressBack={props.onPressBack}
          />
        }
        center={<SpaceChromeTitle title={props.title} size="navigationTitle" />}
        trailing={<SpaceTrailing {...props} />}
        centerPosition="flex"
      />
      {props.notice}
      <StackVertical grow overflow="hidden">
        {props.body}
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
 * `/space/:id` in a space, presentational: Close (and Back), the title, the
 * members / share / rename / end-or-leave actions and the host status over
 * the space's body. Wide paints this chrome as the single top bar; compact
 * nests it in a TopBar. `SpaceActiveLayout` wires it to the space session.
 */
export function SpaceDetailScreenView(
  props: SpaceDetailScreenViewProps
): JSX.Element {
  const mode = useLayoutMode();
  const body = (): JSX.Element => (
    <Show when={props.status === 'ready'} fallback={<LoadingState />}>
      {props.children}
    </Show>
  );
  return (
    <>
      <Show when={mode() === 'wide'}>
        <HideAppFrameHeaderWhileWide />
      </Show>
      <Show
        when={mode() === 'wide'}
        fallback={<SpaceLayoutCompact {...props} body={body()} />}
      >
        <SpaceLayoutWide {...props} body={body()} />
      </Show>
      {props.overlays}
    </>
  );
}
