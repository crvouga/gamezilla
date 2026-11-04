import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Plural, Trans, useLingui } from '@lingui/solid/macro';
import { ActionBar } from '@pkgs/ui-root-client-ts/action-bar';
import { useActionBarChrome } from '@pkgs/ui-root-client-ts/action-bar-chrome';
import type { ActionBarItem } from '@pkgs/ui-root-client-ts/action-bar-logic';
import { actionBarGlyphSize } from '@pkgs/ui-root-client-ts/action-bar-logic';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  IconButton,
  iconButtonAvatarContentSize,
} from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  CircleStopIcon,
  LogOutIcon,
  ShareIcon,
  SquarePenIcon,
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
  /** Where Back goes ("Games"), when the screen named it; else "Back". */
  readonly backLabel?: string | undefined;
};

/** What each space action does when pressed. */
export type SpaceChromeTrailingCallbacks = SpaceChromeNavCallbacks & {
  readonly onPressMembers: () => void;
  readonly onPressShare: () => void;
  readonly onPressRename: () => void;
  readonly onPressEnd: () => void;
  readonly onPressLeave: () => void;
};

/**
 * Minimize and Back at the leading edge of the space bar, in that order on
 * every size. Minimize steps out to the Spaces lobby: the person stays in
 * the space, which goes on in the miniplayer, so it says that instead of a
 * bare Close. ‹ moves within the space and names where it goes ("Games").
 * Wide has room to say each in words; a phone shows the two glyphs, each
 * named for assistive tech and on hover.
 */
export function SpaceChromeLeadingActionBar(
  props: SpaceChromeNavCallbacks
): JSX.Element {
  const { t } = useLingui();
  const chrome = useActionBarChrome();
  const mode = useLayoutMode();
  const backName = (): string => props.backLabel ?? t`Back`;
  const glyph = (): number => actionBarGlyphSize(chrome().buttonSize);
  return (
    <Show
      when={mode() === 'wide'}
      fallback={
        <StackHorizontal align="center" gap="xs">
          <IconButton
            label={t`Minimize space`}
            size={chrome().buttonSize}
            onClick={() => props.onPressHome()}
            dataSet={{ testid: Handles.spaceClose }}
          >
            <ChevronDownIcon size={glyph()} color="icon" />
          </IconButton>
          <Show when={props.onPressBack}>
            {(onPressBack) => (
              <IconButton
                label={backName()}
                size={chrome().buttonSize}
                onClick={() => onPressBack()()}
                dataSet={{ testid: Handles.navBack }}
              >
                <ChevronLeftIcon size={glyph()} color="icon" />
              </IconButton>
            )}
          </Show>
        </StackHorizontal>
      }
    >
      <StackHorizontal align="center" gap="xs">
        <Button
          title={<Trans>Minimize</Trans>}
          aria-label={t`Minimize space`}
          icon={ChevronDownIcon}
          intent="neutral"
          variant="ghost"
          size="sm"
          onClick={() => props.onPressHome()}
          dataSet={{ testid: Handles.spaceClose }}
        />
        <Show when={props.onPressBack}>
          {(onPressBack) => (
            <Button
              title={backName()}
              icon={ChevronLeftIcon}
              intent="neutral"
              variant="ghost"
              size="sm"
              onClick={() => onPressBack()()}
              dataSet={{ testid: Handles.navBack }}
            />
          )}
        </Show>
      </StackHorizontal>
    </Show>
  );
}

/**
 * The members button's name. It follows the count itself, so the bar's items
 * never rebuild (and the button never remounts) while people come and go.
 */
function MembersLabel(props: {
  readonly count: () => number | undefined;
}): JSX.Element {
  return (
    <Show
      when={(props.count() ?? 0) > 0}
      fallback={<Trans>People in this space</Trans>}
    >
      <Plural
        value={props.count() ?? 0}
        one="# person in this space"
        other="# people in this space"
      />
    </Show>
  );
}

type TrailingLabels = {
  readonly members: JSX.Element;
  readonly invite: JSX.Element;
  readonly rename: JSX.Element;
  readonly end: JSX.Element;
  readonly leave: JSX.Element;
};

type TrailingArgs = {
  readonly canRename: boolean;
  readonly canEnd: boolean;
  readonly presence: JSX.Element;
  readonly labels: TrailingLabels;
  readonly callbacks: SpaceChromeTrailingCallbacks;
};

function membersItem(args: TrailingArgs): ActionBarItem {
  return {
    id: 'members',
    variant: 'avatar',
    // The faces carry their own rings: no second outline around the stack.
    plate: 'faces',
    label: args.labels.members,
    onClick: args.callbacks.onPressMembers,
    overflow: 'never',
    priority: 90,
    dataSet: { testid: Handles.spaceMembersButton },
    children: (
      <StackHorizontal align="center" testId={Handles.spacePresenceStrip}>
        {args.presence}
      </StackHorizontal>
    ),
  };
}

/**
 * How someone gets out of the space for good: the host ends it, everyone
 * else leaves. Never on the bar beside everyday controls, where one stray
 * click would end the game for everybody: always in ⋯, after a divider, in
 * red, and each asks to confirm before it does anything.
 */
function exitItems(args: TrailingArgs): ActionBarItem[] {
  const leave: ActionBarItem = {
    id: 'leave-space',
    label: args.labels.leave,
    icon: LogOutIcon,
    onClick: args.callbacks.onPressLeave,
    overflow: 'always',
    tone: 'destructive',
    priority: 40,
    dataSet: { testid: Handles.spaceLeave },
  };
  if (!args.canEnd) return [leave];
  // The host may also leave, which ends the space for everyone too (the
  // leave confirm says so), so leaving never strands people in a space
  // nobody runs.
  return [
    leave,
    {
      id: 'end-space',
      label: args.labels.end,
      icon: CircleStopIcon,
      onClick: args.callbacks.onPressEnd,
      overflow: 'always',
      tone: 'destructive',
      priority: 30,
      dataSet: { testid: Handles.spaceEnd },
    },
  ];
}

function buildTrailingItems(args: TrailingArgs): ActionBarItem[] {
  const everyday: ActionBarItem[] = [
    {
      id: 'share',
      label: args.labels.invite,
      icon: ShareIcon,
      onClick: args.callbacks.onPressShare,
      overflow: 'always',
      priority: 70,
      dataSet: { testid: Handles.spaceShare },
    },
  ];
  if (args.canRename) {
    everyday.push({
      id: 'rename',
      label: args.labels.rename,
      icon: SquarePenIcon,
      onClick: args.callbacks.onPressRename,
      overflow: 'always',
      priority: 60,
      dataSet: { testid: Handles.spaceRename },
    });
  }
  const last = everyday.length - 1;
  return [
    membersItem(args),
    ...everyday.map((item, index) =>
      index === last ? { ...item, endsGroup: true } : item
    ),
    ...exitItems(args),
  ];
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

/**
 * Members, then ⋯ at the far edge with the rest: share and rename, then,
 * set apart in red, the way out (leave, and the host's end). The same on
 * every size.
 */
export function SpaceChromeTrailingActionBar(
  props: SpaceChromeTrailingActionBarProps
): JSX.Element {
  const chrome = useActionBarChrome();
  const args = createMemo(
    (): TrailingArgs => ({
      canRename: props.canRename,
      canEnd: props.canEnd,
      // Each face's own ring adds to it; the stack stays the bar's height.
      presence: props.presence(
        iconButtonAvatarContentSize(chrome().buttonSize)
      ),
      labels: {
        members: <MembersLabel count={() => props.shownCount} />,
        invite: <Trans>Share</Trans>,
        rename: <Trans>Rename</Trans>,
        end: <Trans>End space</Trans>,
        leave: <Trans>Leave space</Trans>,
      },
      callbacks: props.callbacks,
    })
  );
  // Built once per change of size or rights, so the members button keeps its
  // element while people come and go.
  const items = createMemo(() => buildTrailingItems(args()));
  return (
    <ActionBar
      items={items()}
      buttonSize={chrome().buttonSize}
      gap={chrome().gap}
      overflowDataSet={{ testid: Handles.spaceChromeOverflow }}
    />
  );
}
