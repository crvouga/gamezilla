import {
  ActionBar,
  ChevronLeftIcon,
  DoorOpenIcon,
  LogOutIcon,
  ShareIcon,
  SquarePenIcon,
  XIcon,
  iconButtonAvatarContentSize,
  useActionBarChrome,
  type ActionBarItem,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { SpacePresenceStrip } from '../members/space-presence-strip';
import { SpaceMembersListModal } from '../members/space-members-list-modal';
import { useSpacesNavBack } from '../nav/spaces-nav-context';
import { SpaceInviteSheet } from '../space-invite/space-invite-sheet';
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
  onPressInvite: () => void;
  onPressRename: () => void;
  onPressEnd: () => void;
  onPressLeave: () => void;
};

function buildLeadingItems(args: {
  labels: Pick<SpaceChromeLabels, 'home' | 'back'>;
  callbacks: SpaceChromeNavCallbacks;
}): ActionBarItem[] {
  const { labels, callbacks } = args;
  const onPressBack =
    callbacks.onPressBack !== null
      ? callbacks.onPressBack
      : callbacks.onPressHome;

  return [
    {
      id: 'home',
      label: labels.home,
      shortLabel: labels.home,
      icon: DoorOpenIcon,
      onPress: callbacks.onPressHome,
      overflow: 'never',
      priority: 100,
    },
    {
      id: 'back',
      label: labels.back,
      shortLabel: labels.back,
      icon: ChevronLeftIcon,
      onPress: onPressBack,
      overflow: 'never',
      priority: 95,
    },
  ];
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
      id: 'invite',
      label: labels.invite,
      shortLabel: labels.invite,
      icon: ShareIcon,
      onPress: callbacks.onPressInvite,
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
          overflow: 'always',
        }
      : {
          id: 'leave-space',
          label: labels.leave,
          shortLabel: labels.leave,
          icon: LogOutIcon,
          onPress: callbacks.onPressLeave,
          overflow: 'always',
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
      invite: t`Invite`,
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
  onPressInvite: () => void;
  onPressRename: () => void;
}): SpaceChromeTrailingCallbacks {
  const { onPressHome, onRequestEnd, onRequestLeave } = useSpaceSessionUi();
  const onPressBack = useSpacesNavBack();

  return useMemo(
    () => ({
      onPressHome,
      onPressBack,
      onPressMembers: args.onPressMembers,
      onPressInvite: args.onPressInvite,
      onPressRename: args.onPressRename,
      onPressEnd: onRequestEnd,
      onPressLeave: onRequestLeave,
    }),
    [
      onPressHome,
      onPressBack,
      args.onPressMembers,
      args.onPressInvite,
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const onPressMembers = useCallback(() => {
    setMembersOpen(true);
  }, []);
  const onPressInvite = useCallback(() => {
    setInviteOpen(true);
  }, []);
  const labels = useSpaceChromeLabels();
  const callbacks = useSpaceChromeTrailingCallbacks({
    onPressMembers,
    onPressInvite,
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
      <SpaceInviteSheet
        spaceId={spaceId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </>
  );
}
