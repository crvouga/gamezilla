import {
  ActionBar,
  ChevronLeftIcon,
  CodeIcon,
  CopyIcon,
  DoorOpenIcon,
  LogOutIcon,
  PaintbrushIcon,
  SettingsIcon,
  XIcon,
  iconButtonAvatarContentSize,
  type ActionBarItem,
} from '@pkgs/ui';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { SpaceMembersAvatarGroup } from '../members/space-members-avatar-group';
import { SpaceMembersListModal } from '../members/space-members-list-modal';
import { useSpacesNavBack } from '../nav/spaces-nav-context';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { openSpaceSettings } from '../space-routes';
import { useSpaceSessionUi } from './space-session-ui-context';

const BUTTON_SIZE = 36;

function buildInviteLinkForSpace(spaceId: string): string {
  const origin =
    typeof window !== 'undefined' && window.location !== undefined
      ? window.location.origin
      : '';
  // URL paths are not user-facing copy.
  // eslint-disable-next-line lingui/no-unlocalized-strings
  return `${origin}/space/${spaceId}`;
}

type SpaceChromeLabels = {
  home: string;
  back: string;
  members: string;
  rename: string;
  invite: string;
  settings: string;
  developer: string;
  end: string;
  leave: string;
};

type SpaceChromeNavCallbacks = {
  onPressHome: () => void;
  /** Nested-screen back handler, or `null` on the space root. */
  onPressBack: (() => void) | null;
};

type SpaceChromeTrailingCallbacks = SpaceChromeNavCallbacks & {
  onPressMembers: () => void;
  onPressRename: () => void;
  onPressInvite: () => void;
  onPressSettings: () => void;
  onPressDebug: () => void;
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
      icon: DoorOpenIcon,
      onPress: callbacks.onPressHome,
      overflow: 'never',
      priority: 100,
    },
    {
      id: 'back',
      label: labels.back,
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
      endsGroup: true,
      children: <SpaceMembersAvatarGroup spaceId={spaceId} size={avatarSize} />,
    },
  ];

  if (isHost) {
    items.push({
      id: 'rename',
      label: labels.rename,
      icon: PaintbrushIcon,
      onPress: callbacks.onPressRename,
      priority: 80,
    });
  }

  items.push(
    {
      id: 'invite',
      label: labels.invite,
      icon: CopyIcon,
      onPress: callbacks.onPressInvite,
      priority: 70,
    },
    {
      id: 'settings',
      label: labels.settings,
      icon: SettingsIcon,
      onPress: callbacks.onPressSettings,
      priority: 60,
      endsGroup: true,
    },
    {
      id: 'developer',
      label: labels.developer,
      icon: CodeIcon,
      onPress: callbacks.onPressDebug,
      priority: 30,
    },
    isHost
      ? {
          id: 'end-space',
          label: labels.end,
          icon: XIcon,
          onPress: callbacks.onPressEnd,
          overflow: 'always',
        }
      : {
          id: 'leave-space',
          label: labels.leave,
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
      home: t`Go to spaces`,
      back: t`Back`,
      members: t`People in this space`,
      rename: t`Rename space`,
      invite: t`Copy invite link`,
      settings: t`Space settings`,
      developer: t`Developer tools`,
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
  onPressMembers: () => void
): SpaceChromeTrailingCallbacks {
  const router = useRouter();
  const {
    spaceId,
    onPressHome,
    onPressDebug,
    onRequestEnd,
    onRequestLeave,
    onRequestRename,
  } = useSpaceSessionUi();
  const onPressBack = useSpacesNavBack();

  const onCopyInviteLink = useCallback(() => {
    void Clipboard.setStringAsync(buildInviteLinkForSpace(spaceId));
  }, [spaceId]);

  const onOpenSettings = useCallback(() => {
    openSpaceSettings(router, spaceId);
  }, [router, spaceId]);

  return useMemo(
    () => ({
      onPressHome,
      onPressBack,
      onPressMembers,
      onPressRename: onRequestRename,
      onPressInvite: onCopyInviteLink,
      onPressSettings: onOpenSettings,
      onPressDebug,
      onPressEnd: onRequestEnd,
      onPressLeave: onRequestLeave,
    }),
    [
      onPressHome,
      onPressBack,
      onPressMembers,
      onRequestRename,
      onCopyInviteLink,
      onOpenSettings,
      onPressDebug,
      onRequestEnd,
      onRequestLeave,
    ]
  );
}

/**
 * Leading active-space chrome: exit to spaces home + always-visible back
 * (nested handler when registered, otherwise same as exit / space list).
 */
export function SpaceChromeLeadingActionBar(): ReactNode {
  const labels = useSpaceChromeLabels();
  const callbacks = useSpaceChromeNavCallbacks();
  const items = useMemo(
    () => buildLeadingItems({ labels, callbacks }),
    [labels, callbacks]
  );

  return (
    <ActionBar
      items={items}
      align="start"
      overflow="never"
      buttonSize={BUTTON_SIZE}
    />
  );
}

/**
 * Trailing active-space chrome: members avatar + management actions that
 * collapse into overflow when horizontal space is tight.
 */
export function SpaceChromeTrailingActionBar(): ReactNode {
  const { spaceId } = useSpaceSessionUi();
  const [membersOpen, setMembersOpen] = useState(false);
  const onPressMembers = useCallback(() => {
    setMembersOpen(true);
  }, []);
  const labels = useSpaceChromeLabels();
  const callbacks = useSpaceChromeTrailingCallbacks(onPressMembers);
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const avatarSize = iconButtonAvatarContentSize(BUTTON_SIZE);

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
        buttonSize={BUTTON_SIZE}
        overflowTestID="space-chrome-overflow-menu"
      />
      <SpaceMembersListModal
        spaceId={spaceId}
        visible={membersOpen}
        onClose={() => setMembersOpen(false)}
      />
    </>
  );
}
