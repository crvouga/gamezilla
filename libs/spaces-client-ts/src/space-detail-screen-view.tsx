import {
  useAppFrameGlobalTrailing,
  useSetAppFrameHeader,
} from '@pkgs/ui-root-client-ts/app-frame-chrome';
import { AppHeaderIsland } from '@pkgs/ui-root-client-ts/app-header-island';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { TopBar } from '@pkgs/ui-root-client-ts/top-bar';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import type { SpaceChromeTrailingCallbacks } from './space-chrome-action-bar';
import { SpaceChromeTrailingActionBar } from './space-chrome-action-bar';
import {
  SpaceChromeBack,
  SpaceChromeCompactTitle,
  SpaceChromeTrail,
} from './space-chrome-nav';
import { SpaceHostConnectionStatus } from './space-host-connection-status';
import { SpacePresenceStripView } from './space-presence-strip-view';

/** The space's body is still being reached, or shows its content. */
export type SpaceDetailStatus = 'loading' | 'ready';

export type SpaceDetailScreenViewProps = SpaceChromeTrailingCallbacks & {
  /** Custom title, or the localized "<host>'s space" fallback. */
  readonly title: string;
  /** Seeds the room's tile in the wide bar. */
  readonly spaceId?: string | undefined;
  /** The selected game's name, after the room in the bar's trail. */
  readonly place?: string | undefined;
  readonly status: SpaceDetailStatus;
  /** A guest's host has gone; shared features wait for them. */
  readonly hostOffline: boolean;
  readonly canRename: boolean;
  /** The host ends the space; everyone else only leaves. */
  readonly canEnd: boolean;
  /**
   * Faces on the members button; the people glyph when omitted. `compact`
   * asks for the phone's one-button form (the glyph and a count).
   */
  readonly presence?:
    | ((size: number, compact: boolean) => JSX.Element)
    | undefined;
  /** How many people are here: the phone's members badge, and its name. */
  readonly presenceCount?: number | undefined;
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

/**
 * Space actions, the host status (a guest's), then the global avatar menu at
 * the far edge — the bar's own row items (no wrapper), so the ActionBar sizes itself
 * against the title and collapses into its More menu when the row is short.
 */
function SpaceTrailing(
  props: LayoutProps & { readonly compact: boolean }
): JSX.Element {
  const globalTrailing = useAppFrameGlobalTrailing();
  return (
    <>
      <SpaceChromeTrailingActionBar
        shownCount={props.compact ? props.presenceCount : undefined}
        canRename={props.canRename}
        canEnd={props.canEnd}
        presence={(size) =>
          props.presence?.(size, props.compact) ?? (
            <SpacePresenceStripView faces={[]} size={size} />
          )
        }
        callbacks={props}
      />
      {/* Only a guest's host can go offline: the host's bar keeps the room. */}
      <Show when={!props.canEnd}>
        <SpaceHostConnectionStatus offline={props.hostOffline} />
      </Show>
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
          <StackHorizontal grow align="center">
            <SpaceChromeTrail
              title={props.title}
              spaceId={props.spaceId}
              place={props.place}
              onPressBack={props.onPressBack}
              backLabel={props.backLabel}
            />
          </StackHorizontal>
        }
        trailing={<SpaceTrailing {...props} compact={false} />}
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
        // No empty leading slot on the list of games: the title keeps the
        // bar's edge, as a tab screen's does.
        leading={
          props.onPressBack === null ? undefined : (
            <SpaceChromeBack
              title={props.title}
              place={props.place}
              onPressBack={props.onPressBack}
              backLabel={props.backLabel}
            />
          )
        }
        center={
          <SpaceChromeCompactTitle
            title={props.title}
            place={props.place}
            onPressBack={props.onPressBack}
            backLabel={props.backLabel}
          />
        }
        trailing={<SpaceTrailing {...props} compact />}
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
 * `/space/:id` in a space, presentational: where the person is (the room,
 * then the selected game, its parent the one way back), the members,
 * Minimize and ⋯ (share / rename / end-or-leave) and the host status over
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
