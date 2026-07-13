import {
  ActionBar,
  ChevronLeftIcon,
  CopyIcon,
  DoorOpenIcon,
  LogOutIcon,
  SquarePenIcon,
  XIcon,
  iconButtonAvatarContentSize,
  useActionBarChrome,
  type ActionBarItem,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { SpaceMembersAvatarGroup } from '../members/space-members-avatar-group';
import { SpaceMembersListModal } from '../members/space-members-list-modal';
import { useSpacesNavBack } from '../nav/spaces-nav-context';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { SpaceInviteSheet } from '../space-invite/space-invite-sheet';
import { useSpaceSessionUi } from './space-session-ui-context';

type SpaceChromeLabels = {
  home: string;
  back: string;
  members: string;
  rename: string;
  renameShort: string;
  invite: string;
  inviteShort: string;
  end: string;
  leave: string;
};

type SpaceChromeNavCallbacks = {
  onPressHome: () => void;
  onPressBack: (() => void) | null;
};

type SpaceChromeTrailingCallbacks = SpaceChromeNavCallbacks & {
  onPressMembers: () => void;
  onPressRename: () => void;
  onPressInvite: () => void;
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
      onPress: callbacks.onPressMembers,
      overflow: 'never',
      priority: 90,
      children: <SpaceMembersAvatarGroup spaceId={spaceId} size={avatarSize} />,
    },
  ];

  if (isHost) {
    items.push({
      id: 'rename',
      label: labels.rename,
      shortLabel: labels.renameShort,
      icon: SquarePenIcon,
      onPress: callbacks.onPressRename,
      priority: 80,
    });
  }

  items.push(
    {
      id: 'invite',
      label: labels.invite,
      shortLabel: labels.inviteShort,
      icon: CopyIcon,
      onPress: callbacks.onPressInvite,
      priority: 70,
    },
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
      rename: t`Rename space`,
      renameShort: t`Rename`,
      invite: t`Invite`,
      inviteShort: t`Invite`,
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

function useSpaceChromeTrailingCallbacks(
  onPressMembers: () => void,
  onPressInvite: () => void
): SpaceChromeTrailingCallbacks {
  const { onPressHome, onRequestEnd, onRequestLeave, onRequestRename } =
    useSpaceSessionUi();
  const onPressBack = useSpacesNavBack();

  return useMemo(
    () => ({
      onPressHome,
      onPressBack,
      onPressMembers,
      onPressRename: onRequestRename,
      onPressInvite,
      onPressEnd: onRequestEnd,
      onPressLeave: onRequestLeave,
    }),
    [
      onPressHome,
      onPressBack,
      onPressMembers,
      onRequestRename,
      onPressInvite,
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
  const { spaceId } = useSpaceSessionUi();
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const onPressMembers = useCallback(() => {
    setMembersOpen(true);
  }, []);
  const onPressInvite = useCallback(() => {
    setInviteOpen(true);
  }, []);
  const labels = useSpaceChromeLabels();
  const callbacks = useSpaceChromeTrailingCallbacks(
    onPressMembers,
    onPressInvite
  );
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
