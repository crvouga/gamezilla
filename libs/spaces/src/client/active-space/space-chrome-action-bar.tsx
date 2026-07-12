import {
  ActionBar,
  CodeIcon,
  CopyIcon,
  LogOutIcon,
  PaintbrushIcon,
  SettingsIcon,
  XIcon,
  type ActionBarItem,
} from '@pkgs/ui';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';

import { useCurrentSpaceRole } from '../use-current-space-role';
import { openSpaceSettings } from '../space-routes';
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

type SpaceChromeLabels = {
  rename: string;
  invite: string;
  settings: string;
  developer: string;
  end: string;
  leave: string;
};

type SpaceChromeCallbacks = {
  onPressRename: () => void;
  onPressInvite: () => void;
  onPressSettings: () => void;
  onPressDebug: () => void;
  onPressEnd: () => void;
  onPressLeave: () => void;
};

function buildSpaceChromeActionBarItems(args: {
  isHost: boolean;
  labels: SpaceChromeLabels;
  callbacks: SpaceChromeCallbacks;
}): ActionBarItem[] {
  const { isHost, labels, callbacks } = args;
  const items: ActionBarItem[] = [];

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
    }
  );

  items.push(
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

export function useSpaceChromeActionBarItems(): ActionBarItem[] {
  const { t } = useLingui();
  const router = useRouter();
  const {
    spaceId,
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
    openSpaceSettings(router, spaceId);
  }, [router, spaceId]);

  return useMemo(
    () =>
      buildSpaceChromeActionBarItems({
        isHost,
        labels: {
          rename: t`Rename space`,
          invite: t`Copy invite link`,
          settings: t`Space settings`,
          developer: t`Developer tools`,
          end: t`End space`,
          leave: t`Leave space`,
        },
        callbacks: {
          onPressRename: onRequestRename,
          onPressInvite: onCopyInviteLink,
          onPressSettings: onOpenSettings,
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
      onPressDebug,
      onRequestEnd,
      onRequestLeave,
    ]
  );
}

/**
 * Responsive active-space trailing actions. Management actions collapse into
 * the overflow menu when horizontal space is tight; exit lives in leading
 * chrome via {@link SpaceChromeHomeButton}.
 */
export function SpaceChromeActionBar(): ReactNode {
  const items = useSpaceChromeActionBarItems();
  return (
    <ActionBar
      items={items}
      buttonSize={36}
      overflowTestID="space-chrome-overflow-menu"
    />
  );
}
