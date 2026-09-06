import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/react/macro';
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
} from '@pkgs/ui-rn';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useSpacesNavBack } from '../../../public/nav/spaces-nav-context';
import { SpaceMembersListModal } from '../members/space-members-list-modal';
import { SpacePresenceStrip } from '../members/space-presence-strip';
import { SpaceShareSheet } from '../space-users/space-share-sheet';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { useSpaceSessionUi } from './space-session-ui-context';

type SpaceChromeLabels = {
  home: string;
  back: string;
  members: string;
  membersShort: string;
  invite: string;
  rename: string;
  end: string;
  leave: string;
};

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
  labels: Pick<SpaceChromeLabels, 'home' | 'back'>;
  callbacks: SpaceChromeNavCallbacks;
}): ActionBarItem[] {
  const { labels, callbacks } = args;
  const items: ActionBarItem[] = [
    {
      id: 'home',
      label: labels.home,
      shortLabel: labels.home,
      icon: DoorOpenIcon,
      onPress: callbacks.onPressHome,
      overflow: 'never',
      priority: 100,
      testID: Handles.spaceClose,
    },
  ];
  // Back only exists when there is somewhere inside the space to go back to;
  // at the games menu it would duplicate Close.
  if (callbacks.onPressBack !== null) {
    items.push({
      id: 'back',
      label: labels.back,
      shortLabel: labels.back,
      icon: ChevronLeftIcon,
      onPress: callbacks.onPressBack,
      overflow: 'never',
      priority: 95,
      testID: Handles.navBack,
    });
  }
  return items;
}

function buildTrailingItems(args: {
  isHost: boolean;
  spaceId: string;
  avatarSize: number;
  labels: SpaceChromeLabels;
  callbacks: SpaceChromeTrailingCallbacks;
}): ActionBarItem[] {
  const { isHost, spaceId, avatarSize, labels, callbacks } = args;
  const items: ActionBarItem[] = [
    {
      id: 'members',
      variant: 'avatar',
      label: labels.members,
      shortLabel: labels.membersShort,
      onPress: callbacks.onPressMembers,
      overflow: 'never',
      priority: 90,
      children: <SpacePresenceStrip spaceId={spaceId} size={avatarSize} />,
    },
    {
      id: 'share',
      label: labels.invite,
      shortLabel: labels.invite,
      icon: ShareIcon,
      onPress: callbacks.onPressShare,
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
      onPress: callbacks.onPressRename,
      overflow: 'always',
      priority: 60,
    });
  }

  items.push(
    isHost
      ? {
          id: 'end-space',
          label: labels.end,
          shortLabel: labels.end,
          icon: XIcon,
          onPress: callbacks.onPressEnd,
          overflow: 'never',
          priority: 95,
          testID: Handles.spaceEnd,
        }
      : {
          id: 'leave-space',
          label: labels.leave,
          shortLabel: labels.leave,
          icon: LogOutIcon,
          onPress: callbacks.onPressLeave,
          overflow: 'never',
          priority: 95,
          testID: Handles.spaceLeave,
        }
  );

  return items;
}

function useSpaceChromeLabels(): SpaceChromeLabels {
  const { t } = useLingui();
  return useMemo(
    () => ({
      home: t`Close`,
      back: t`Back`,
      members: t`People in this space`,
      membersShort: t`People`,
      invite: t`Share`,
      rename: t`Rename`,
      end: t`End space`,
      leave: t`Leave space`,
    }),
    [t]
  );
}

function useSpaceChromeNavCallbacks(): SpaceChromeNavCallbacks {
  const { onPressHome } = useSpaceSessionUi();
  const onPressBack = useSpacesNavBack();
  return useMemo(
    () => ({ onPressHome, onPressBack }),
    [onPressHome, onPressBack]
  );
}

function useSpaceChromeTrailingCallbacks(args: {
  onPressMembers: () => void;
  onPressShare: () => void;
  onPressRename: () => void;
}): SpaceChromeTrailingCallbacks {
  const { onPressHome, onRequestEnd, onRequestLeave } = useSpaceSessionUi();
  const onPressBack = useSpacesNavBack();

  return useMemo(
    () => ({
      onPressHome,
      onPressBack,
      onPressMembers: args.onPressMembers,
      onPressShare: args.onPressShare,
      onPressRename: args.onPressRename,
      onPressEnd: onRequestEnd,
      onPressLeave: onRequestLeave,
    }),
    [
      onPressHome,
      onPressBack,
      args.onPressMembers,
      args.onPressShare,
      args.onPressRename,
      onRequestEnd,
      onRequestLeave,
    ]
  );
}

function useSpaceChromeActionBarProps() {
  const chrome = useActionBarChrome();
  return useMemo(
    () => ({
      buttonSize: chrome.buttonSize,
      gap: chrome.gap,
      slotWidth: chrome.slotWidth,
      showInlineLabels: chrome.showInlineLabels,
    }),
    [chrome]
  );
}

export function SpaceChromeLeadingActionBar(): ReactNode {
  const labels = useSpaceChromeLabels();
  const callbacks = useSpaceChromeNavCallbacks();
  const actionBarProps = useSpaceChromeActionBarProps();
  const items = useMemo(
    () => buildLeadingItems({ labels, callbacks }),
    [labels, callbacks]
  );

  return (
    <ActionBar
      items={items}
      align="start"
      overflow="never"
      {...actionBarProps}
    />
  );
}

export function SpaceChromeTrailingActionBar(): ReactNode {
  const { spaceId, onRequestRename } = useSpaceSessionUi();
  const [membersOpen, setMembersOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const onPressMembers = useCallback(() => {
    setMembersOpen(true);
  }, []);
  const onPressShare = useCallback(() => {
    setShareOpen(true);
  }, []);
  const labels = useSpaceChromeLabels();
  const callbacks = useSpaceChromeTrailingCallbacks({
    onPressMembers,
    onPressShare,
    onPressRename: onRequestRename,
  });
  const actionBarProps = useSpaceChromeActionBarProps();
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const avatarSize = iconButtonAvatarContentSize(actionBarProps.buttonSize);

  const items = useMemo(
    () =>
      buildTrailingItems({
        isHost,
        spaceId,
        avatarSize,
        labels,
        callbacks,
      }),
    [isHost, spaceId, avatarSize, labels, callbacks]
  );

  return (
    <>
      <ActionBar
        items={items}
        {...actionBarProps}
        overflowTestID="space-chrome-overflow-menu"
      />
      <SpaceMembersListModal
        spaceId={spaceId}
        visible={membersOpen}
        onClose={() => setMembersOpen(false)}
      />
      <SpaceShareSheet
        spaceId={spaceId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  );
}
