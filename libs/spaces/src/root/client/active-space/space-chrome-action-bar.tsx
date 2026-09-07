import { Handles } from '@libs/test-ids';
import { Trans } from '@lingui/solid/macro';
import {
  ActionBar,
  type ActionBarItem,
  ChevronLeftIcon,
  DoorOpenIcon,
  iconButtonAvatarContentSize,
  LogOutIcon,
  ShareIcon,
  SquarePenIcon,
  useActionBarChrome,
  XIcon,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo, createSignal } from 'solid-js';
import { useSpacesNavBack } from '../../../public/nav/spaces-nav-context';
import { SpaceMembersListModal } from '../members/space-members-list-modal';
import { SpacePresenceStrip } from '../members/space-presence-strip';
import { SpaceShareSheet } from '../space-users/space-share-sheet';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { useSpaceSessionUi } from './space-session-ui-context';

type SpaceChromeNavCallbacks = {
  onPressHome: () => void;
  onPressBack: (() => void) | null;
};

type SpaceChromeTrailingCallbacks = SpaceChromeNavCallbacks & {
  onPressMembers: () => void;
  onPressShare: () => void;
  onPressRename: () => void;
  onPressEnd: () => void;
  onPressLeave: () => void;
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
      shortLabel: close,
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
      shortLabel: back,
      icon: ChevronLeftIcon,
      onClick: callbacks.onPressBack,
      overflow: 'never',
      priority: 95,
      dataSet: { testid: Handles.navBack },
    });
  }
  return items;
}

function hostLeaveItem(args: {
  isHost: boolean;
  end: JSX.Element;
  leave: JSX.Element;
  callbacks: SpaceChromeTrailingCallbacks;
}): ActionBarItem {
  if (args.isHost) {
    return {
      id: 'end-space',
      label: args.end,
      shortLabel: args.end,
      icon: XIcon,
      onClick: args.callbacks.onPressEnd,
      overflow: 'never',
      priority: 95,
      dataSet: { testid: Handles.spaceEnd },
    };
  }
  return {
    id: 'leave-space',
    label: args.leave,
    shortLabel: args.leave,
    icon: LogOutIcon,
    onClick: args.callbacks.onPressLeave,
    overflow: 'never',
    priority: 95,
    dataSet: { testid: Handles.spaceLeave },
  };
}

function buildTrailingItems(args: {
  isHost: boolean;
  spaceId: string;
  avatarSize: number;
  labels: {
    members: JSX.Element;
    membersShort: JSX.Element;
    invite: JSX.Element;
    rename: JSX.Element;
    end: JSX.Element;
    leave: JSX.Element;
  };
  callbacks: SpaceChromeTrailingCallbacks;
}): ActionBarItem[] {
  const { isHost, spaceId, avatarSize, labels, callbacks } = args;
  const items: ActionBarItem[] = [
    {
      id: 'members',
      variant: 'avatar',
      label: labels.members,
      shortLabel: labels.membersShort,
      onClick: callbacks.onPressMembers,
      overflow: 'never',
      priority: 90,
      children: <SpacePresenceStrip spaceId={spaceId} size={avatarSize} />,
    },
    {
      id: 'share',
      label: labels.invite,
      shortLabel: labels.invite,
      icon: ShareIcon,
      onClick: callbacks.onPressShare,
      overflow: 'always',
      priority: 70,
    },
  ];

  if (isHost) {
    items.push({
      id: 'rename',
      label: labels.rename,
      shortLabel: labels.rename,
      icon: SquarePenIcon,
      onClick: callbacks.onPressRename,
      overflow: 'always',
      priority: 60,
    });
  }

  items.push(
    hostLeaveItem({
      isHost,
      end: labels.end,
      leave: labels.leave,
      callbacks,
    })
  );
  return items;
}

export function SpaceChromeLeadingActionBar(): JSX.Element {
  const { onPressHome } = useSpaceSessionUi();
  const onPressBack = useSpacesNavBack();
  const chrome = useActionBarChrome();
  const items = createMemo(() =>
    buildLeadingItems({
      close: <Trans>Close</Trans>,
      back: <Trans>Back</Trans>,
      callbacks: {
        onPressHome,
        onPressBack: onPressBack(),
      },
    })
  );

  return (
    <ActionBar
      items={items()}
      align="start"
      overflow="never"
      buttonSize={chrome().buttonSize}
      gap={chrome().gap}
      slotWidth={chrome().slotWidth}
      showInlineLabels={chrome().showInlineLabels}
    />
  );
}

export function SpaceChromeTrailingActionBar(): JSX.Element {
  const sessionUi = useSpaceSessionUi();
  const [membersOpen, setMembersOpen] = createSignal(false);
  const [shareOpen, setShareOpen] = createSignal(false);
  const chrome = useActionBarChrome();
  const onPressBack = useSpacesNavBack();
  const role = useCurrentSpaceRole(() => sessionUi.spaceId);
  const isHost = createMemo(() => role() === 'host');
  const avatarSize = createMemo(() =>
    iconButtonAvatarContentSize(chrome().buttonSize)
  );
  const callbacks = createMemo(
    (): SpaceChromeTrailingCallbacks => ({
      onPressHome: sessionUi.onPressHome,
      onPressBack: onPressBack(),
      onPressMembers: () => setMembersOpen(true),
      onPressShare: () => setShareOpen(true),
      onPressRename: sessionUi.onRequestRename,
      onPressEnd: sessionUi.onRequestEnd,
      onPressLeave: sessionUi.onRequestLeave,
    })
  );
  const items = createMemo(() =>
    buildTrailingItems({
      isHost: isHost(),
      spaceId: sessionUi.spaceId,
      avatarSize: avatarSize(),
      labels: {
        members: <Trans>People in this space</Trans>,
        membersShort: <Trans>People</Trans>,
        invite: <Trans>Share</Trans>,
        rename: <Trans>Rename</Trans>,
        end: <Trans>End space</Trans>,
        leave: <Trans>Leave space</Trans>,
      },
      callbacks: callbacks(),
    })
  );

  return (
    <>
      <ActionBar
        items={items()}
        buttonSize={chrome().buttonSize}
        gap={chrome().gap}
        slotWidth={chrome().slotWidth}
        showInlineLabels={chrome().showInlineLabels}
        overflowDataSet={{ testid: 'space-chrome-overflow-menu' }}
      />
      <SpaceMembersListModal
        spaceId={sessionUi.spaceId}
        visible={membersOpen()}
        onClose={() => setMembersOpen(false)}
      />
      <SpaceShareSheet
        spaceId={sessionUi.spaceId}
        open={shareOpen()}
        onOpenChange={setShareOpen}
      />
    </>
  );
}
