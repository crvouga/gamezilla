import { OverflowMenuButton, type OverflowMenuAction } from '@gamezilla/ui';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';

import { useCurrentSpaceRole } from '../use-current-space-role';
import { useSpaceSessionUi } from './space-session-ui-context';

function buildInviteLinkForSpace(spaceId: string): string {
  const origin =
    typeof window !== 'undefined' && window.location !== undefined
      ? window.location.origin
      : '';
  // URL paths are not user-facing copy.
  // eslint-disable-next-line lingui/no-unlocalized-strings
  return `${origin}/space/${spaceId}`;
}

/**
 * Active-space overflow dropdown. Hosts space-management actions
 * (rename, copy invite, settings), the existing "go home" / developer
 * affordances, and the destructive End/Leave action as the last row.
 * Role-gated entries (rename, end-vs-leave) resolve via
 * {@link useCurrentSpaceRole}.
 */
export function SpaceChromeOverflowMenu(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const {
    spaceId,
    onPressHome,
    onPressDebug,
    onRequestEnd,
    onRequestLeave,
    onRequestRename,
  } = useSpaceSessionUi();
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';

  const onCopyInviteLink = useCallback(() => {
    void Clipboard.setStringAsync(buildInviteLinkForSpace(spaceId));
  }, [spaceId]);

  const onOpenSettings = useCallback(() => {
    router.push({
      pathname: '/space/[id]/settings',
      params: { id: spaceId },
    });
  }, [router, spaceId]);

  const actions = useMemo<readonly OverflowMenuAction[]>(
    () =>
      buildOverflowMenuActions({
        isHost,
        labels: {
          rename: t`Rename space`,
          invite: t`Copy invite link`,
          settings: t`Space settings`,
          home: t`Go to spaces`,
          developer: t`Developer tools`,
          end: t`End space`,
          leave: t`Leave space`,
        },
        callbacks: {
          onPressRename: onRequestRename,
          onPressInvite: onCopyInviteLink,
          onPressSettings: onOpenSettings,
          onPressHome,
          onPressDebug,
          onPressEnd: onRequestEnd,
          onPressLeave: onRequestLeave,
        },
      }),
    [
      isHost,
      t,
      onRequestRename,
      onCopyInviteLink,
      onOpenSettings,
      onPressHome,
      onPressDebug,
      onRequestEnd,
      onRequestLeave,
    ]
  );

  return (
    <OverflowMenuButton
      actions={actions}
      header={{ title: t`More` }}
      accessibilityLabel={t`More options`}
    />
  );
}

type OverflowMenuLabels = {
  rename: string;
  invite: string;
  settings: string;
  home: string;
  developer: string;
  end: string;
  leave: string;
};

type OverflowMenuCallbacks = {
  onPressRename: () => void;
  onPressInvite: () => void;
  onPressSettings: () => void;
  onPressHome: () => void;
  onPressDebug: () => void;
  onPressEnd: () => void;
  onPressLeave: () => void;
};

function buildManagementActions(
  isHost: boolean,
  labels: OverflowMenuLabels,
  callbacks: OverflowMenuCallbacks
): OverflowMenuAction[] {
  const actions: OverflowMenuAction[] = [];
  if (isHost) {
    actions.push({
      id: 'rename',
      label: labels.rename,
      icon: 'paintbrush.fill',
      onPress: callbacks.onPressRename,
    });
  }
  actions.push({
    id: 'invite',
    label: labels.invite,
    icon: 'copy',
    onPress: callbacks.onPressInvite,
  });
  actions.push({
    id: 'settings',
    label: labels.settings,
    icon: 'gearshape.fill',
    onPress: callbacks.onPressSettings,
    endsGroup: true,
  });
  return actions;
}

function buildNavAndDevActions(
  labels: OverflowMenuLabels,
  callbacks: OverflowMenuCallbacks
): OverflowMenuAction[] {
  return [
    {
      id: 'spaces-home',
      label: labels.home,
      icon: 'house.fill',
      onPress: callbacks.onPressHome,
    },
    {
      id: 'developer',
      label: labels.developer,
      icon: 'chevron.left.forwardslash.chevron.right',
      onPress: callbacks.onPressDebug,
      endsGroup: true,
    },
  ];
}

function buildDestructiveAction(
  isHost: boolean,
  labels: OverflowMenuLabels,
  callbacks: OverflowMenuCallbacks
): OverflowMenuAction {
  return isHost
    ? {
        id: 'end-space',
        label: labels.end,
        icon: 'xmark',
        onPress: callbacks.onPressEnd,
      }
    : {
        id: 'leave-space',
        label: labels.leave,
        icon: 'arrow.right.from.bracket',
        onPress: callbacks.onPressLeave,
      };
}

function buildOverflowMenuActions({
  isHost,
  labels,
  callbacks,
}: {
  isHost: boolean;
  labels: OverflowMenuLabels;
  callbacks: OverflowMenuCallbacks;
}): readonly OverflowMenuAction[] {
  return [
    ...buildManagementActions(isHost, labels, callbacks),
    ...buildNavAndDevActions(labels, callbacks),
    buildDestructiveAction(isHost, labels, callbacks),
  ];
}
