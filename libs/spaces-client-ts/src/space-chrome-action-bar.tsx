import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Plural, Trans } from '@lingui/solid/macro';
import { ActionBar } from '@pkgs/ui-root-client-ts/action-bar';
import { useActionBarChrome } from '@pkgs/ui-root-client-ts/action-bar-chrome';
import type { ActionBarItem } from '@pkgs/ui-root-client-ts/action-bar-logic';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { iconButtonAvatarContentSize } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronLeftIcon,
  DoorOpenIcon,
  LogOutIcon,
  ShareIcon,
  SquarePenIcon,
  XIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';

/** Leaving the space's screen, and going back inside it when there is a way. */
export type SpaceChromeNavCallbacks = {
  readonly onPressHome: () => void;
  /** Back inside the space; null at the games menu, where it would be Close. */
  readonly onPressBack: (() => void) | null;
};

/** What each space action does when pressed. */
export type SpaceChromeTrailingCallbacks = SpaceChromeNavCallbacks & {
  readonly onPressMembers: () => void;
  readonly onPressShare: () => void;
  readonly onPressRename: () => void;
  readonly onPressEnd: () => void;
  readonly onPressLeave: () => void;
};

function buildLeadingItems(args: {
  back: JSX.Element;
  close: JSX.Element;
  callbacks: SpaceChromeNavCallbacks;
}): ActionBarItem[] {
  const { back, close, callbacks } = args;
  const items: ActionBarItem[] = [
    {
      id: 'home',
      label: close,
      icon: DoorOpenIcon,
      onClick: callbacks.onPressHome,
      overflow: 'never',
      priority: 100,
      dataSet: { testid: Handles.spaceClose },
    },
  ];
  // Back only exists when there is somewhere inside the space to go back to;
  // at the games menu it would duplicate Close.
  if (callbacks.onPressBack !== null) {
    items.push({
      id: 'back',
      label: back,
      icon: ChevronLeftIcon,
      onClick: callbacks.onPressBack,
      overflow: 'never',
      priority: 95,
      dataSet: { testid: Handles.navBack },
    });
  }
  return items;
}

function leaveItem(
  leave: JSX.Element,
  callbacks: SpaceChromeTrailingCallbacks,
  overflow: 'never' | 'always'
): ActionBarItem {
  return {
    id: 'leave-space',
    label: leave,
    icon: LogOutIcon,
    onClick: callbacks.onPressLeave,
    overflow,
    priority: 94,
    dataSet: { testid: Handles.spaceLeave },
  };
}

/**
 * A member leaves; the host may end the space, or leave it — which ends it
 * for everyone too (the leave confirm says so), so leaving never strands
 * people in a space nobody runs.
 */
function exitItems(args: {
  canEnd: boolean;
  end: JSX.Element;
  leave: JSX.Element;
  callbacks: SpaceChromeTrailingCallbacks;
}): ActionBarItem[] {
  if (!args.canEnd) return [leaveItem(args.leave, args.callbacks, 'never')];
  return [
    {
      id: 'end-space',
      label: args.end,
      icon: XIcon,
      onClick: args.callbacks.onPressEnd,
      overflow: 'never',
      priority: 95,
      dataSet: { testid: Handles.spaceEnd },
    },
    leaveItem(args.leave, args.callbacks, 'always'),
  ];
}

function buildTrailingItems(args: {
  canRename: boolean;
  canEndSpace: boolean;
  presence: JSX.Element;
  labels: {
    members: JSX.Element;
    invite: JSX.Element;
    rename: JSX.Element;
    end: JSX.Element;
    leave: JSX.Element;
  };
  callbacks: SpaceChromeTrailingCallbacks;
}): ActionBarItem[] {
  const { canRename, canEndSpace, presence, labels, callbacks } = args;
  const items: ActionBarItem[] = [
    {
      id: 'members',
      variant: 'avatar',
      label: labels.members,
      onClick: callbacks.onPressMembers,
      overflow: 'never',
      priority: 90,
      dataSet: { testid: Handles.spaceMembersButton },
      children: (
        <StackHorizontal align="center" testId={Handles.spacePresenceStrip}>
          {presence}
        </StackHorizontal>
      ),
    },
    {
      id: 'share',
      label: labels.invite,
      icon: ShareIcon,
      onClick: callbacks.onPressShare,
      overflow: 'always',
      priority: 70,
      dataSet: { testid: Handles.spaceShare },
    },
  ];

  if (canRename) {
    items.push({
      id: 'rename',
      label: labels.rename,
      icon: SquarePenIcon,
      onClick: callbacks.onPressRename,
      overflow: 'always',
      priority: 60,
      dataSet: { testid: Handles.spaceRename },
    });
  }

  items.push(
    ...exitItems({
      canEnd: canEndSpace,
      end: labels.end,
      leave: labels.leave,
      callbacks,
    })
  );
  return items;
}

/** Close (and Back inside the space) at the leading edge of the space bar. */
export function SpaceChromeLeadingActionBar(
  props: SpaceChromeNavCallbacks
): JSX.Element {
  const chrome = useActionBarChrome();
  const items = createMemo(() =>
    buildLeadingItems({
      close: <Trans>Close</Trans>,
      back: <Trans>Back</Trans>,
      callbacks: {
        onPressHome: props.onPressHome,
        onPressBack: props.onPressBack,
      },
    })
  );

  const mode = useLayoutMode();
  return (
    <Show
      when={mode() === 'wide'}
      fallback={
        <ActionBar
          items={items()}
          align="start"
          overflow="never"
          buttonSize={chrome().buttonSize}
          gap={chrome().gap}
        />
      }
    >
      {/* Wide has room to say where each control goes. */}
      <StackHorizontal align="center" gap="xs">
        <Button
          title={<Trans>Close</Trans>}
          icon={DoorOpenIcon}
          variant="ghost"
          size="sm"
          onClick={props.onPressHome}
          dataSet={{ testid: Handles.spaceClose }}
        />
        <Show when={props.onPressBack}>
          {(onPressBack) => (
            <Button
              title={<Trans>Back</Trans>}
              icon={ChevronLeftIcon}
              variant="ghost"
              size="sm"
              onClick={onPressBack()}
              dataSet={{ testid: Handles.navBack }}
            />
          )}
        </Show>
      </StackHorizontal>
    </Show>
  );
}

export type SpaceChromeTrailingActionBarProps = {
  /**
   * How many people the members button shows as a number (the phone's
   * badge); its name then says that number too, as a sighted person reads it.
   */
  readonly shownCount?: number | undefined;
  readonly canRename: boolean;
  /** The host ends the space; everyone else only leaves. */
  readonly canEnd: boolean;
  /** Faces on the members button, at the bar's avatar size. */
  readonly presence: (size: number) => JSX.Element;
  readonly callbacks: SpaceChromeTrailingCallbacks;
};

/** Members, share, rename and end / leave, collapsing into More when short. */
export function SpaceChromeTrailingActionBar(
  props: SpaceChromeTrailingActionBarProps
): JSX.Element {
  const chrome = useActionBarChrome();
  const avatarSize = createMemo(() =>
    iconButtonAvatarContentSize(chrome().buttonSize)
  );
  const items = createMemo(() =>
    buildTrailingItems({
      canRename: props.canRename,
      canEndSpace: props.canEnd,
      presence: props.presence(avatarSize()),
      labels: {
        members:
          props.shownCount === undefined || props.shownCount === 0 ? (
            <Trans>People in this space</Trans>
          ) : (
            <Plural
              value={props.shownCount}
              one="# person in this space"
              other="# people in this space"
            />
          ),
        invite: <Trans>Share</Trans>,
        rename: <Trans>Rename</Trans>,
        end: <Trans>End space</Trans>,
        leave: <Trans>Leave space</Trans>,
      },
      callbacks: props.callbacks,
    })
  );

  return (
    <ActionBar
      items={items()}
      buttonSize={chrome().buttonSize}
      gap={chrome().gap}
      overflowDataSet={{ testid: Handles.spaceChromeOverflow }}
    />
  );
}
