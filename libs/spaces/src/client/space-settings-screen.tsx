import {
  MainMenuScreen,
  SafeAreaView,
  TopBar,
  BackIconButton,
  Box,
  type MainMenuItem,
} from '@pkgs/ui';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { RenameSpaceModal } from './active-space/rename-space-modal';
import { useSpaceLifecycleModals } from './lifecycle/space-lifecycle-modal-provider';
import { useStripRedundantSpaceRouteSearchParams } from './space-routes';
import { useCurrentSpaceRole } from './use-current-space-role';

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
 * Minimal settings surface for an active space: rename, copy invite link,
 * and the destructive End / Leave action. End/leave confirms use
 * {@link SpaceLifecycleModalProvider} for consistent mutation UX.
 */
export function SpaceSettingsScreen(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = typeof id === 'string' ? id : '';
  useStripRedundantSpaceRouteSearchParams(spaceId);
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const { requestEndSpace, requestLeaveSpace } = useSpaceLifecycleModals();

  const [renameOpen, setRenameOpen] = useState(false);

  const onCopyInviteLink = useCallback(() => {
    void Clipboard.setStringAsync(buildInviteLinkForSpace(spaceId));
  }, [spaceId]);

  const onEnd = useCallback(() => {
    requestEndSpace(spaceId, { onSuccess: () => router.back() });
  }, [requestEndSpace, spaceId, router]);

  const onLeave = useCallback(() => {
    requestLeaveSpace(spaceId, { onSuccess: () => router.back() });
  }, [requestLeaveSpace, spaceId, router]);

  const items = useMemo<MainMenuItem[]>(
    () =>
      buildSettingsMenuItems({
        isHost,
        labels: {
          rename: t`Rename space`,
          invite: t`Copy invite link`,
          end: t`End space`,
          leave: t`Leave space`,
          endCaption: t`Closes the space for everyone.`,
          leaveCaption: t`You can rejoin from the host's invite link.`,
        },
        onRename: () => setRenameOpen(true),
        onCopyInvite: onCopyInviteLink,
        onEnd,
        onLeave,
      }),
    [isHost, onCopyInviteLink, onEnd, onLeave, t]
  );

  return (
    <SafeAreaView sx={{ flex: 1, background: 'background' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <TopBar
          safeAreaTop={false}
          leading={<BackIconButton onPress={() => router.back()} />}
        />
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <MainMenuScreen
            title={<Trans>Space settings</Trans>}
            subtitle={<Trans>Manage this space.</Trans>}
            items={items}
          />
        </Box>
        <RenameSpaceModal
          spaceId={spaceId}
          visible={renameOpen}
          onClose={() => setRenameOpen(false)}
        />
      </Box>
    </SafeAreaView>
  );
}

type SettingsMenuLabels = {
  rename: string;
  invite: string;
  end: string;
  leave: string;
  endCaption: string;
  leaveCaption: string;
};

function buildSettingsMenuItems({
  isHost,
  labels,
  onRename,
  onCopyInvite,
  onEnd,
  onLeave,
}: {
  isHost: boolean;
  labels: SettingsMenuLabels;
  onRename: () => void;
  onCopyInvite: () => void;
  onEnd: () => void;
  onLeave: () => void;
}): MainMenuItem[] {
  const items: MainMenuItem[] = [];
  if (isHost) {
    items.push({
      key: 'rename',
      title: labels.rename,
      onPress: onRename,
    });
  }
  items.push({
    key: 'invite',
    title: labels.invite,
    onPress: onCopyInvite,
  });
  items.push(
    isHost
      ? {
          key: 'end',
          title: labels.end,
          caption: labels.endCaption,
          onPress: onEnd,
        }
      : {
          key: 'leave',
          title: labels.leave,
          caption: labels.leaveCaption,
          onPress: onLeave,
        }
  );
  return items;
}
