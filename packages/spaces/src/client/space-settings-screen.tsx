import {
  MainMenuScreen,
  SafeAreaView,
  TopBar,
  BackIconButton,
  Box,
  type MainMenuItem,
} from '@gamezilla/ui';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { RenameSpaceModal } from './active-space/rename-space-modal';
import { EndSpaceModal } from './lifecycle/end-space-modal';
import { LeaveSpaceModal } from './lifecycle/leave-space-modal';
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
 * and the destructive End / Leave action. Reuses the same modals as the
 * overflow menu so behavior is consistent across entry points.
 */
export function SpaceSettingsScreen(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = typeof id === 'string' ? id : '';
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';

  const [renameOpen, setRenameOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const onCopyInviteLink = useCallback(() => {
    void Clipboard.setStringAsync(buildInviteLinkForSpace(spaceId));
  }, [spaceId]);

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
        onEnd: () => setEndOpen(true),
        onLeave: () => setLeaveOpen(true),
      }),
    [isHost, onCopyInviteLink, t]
  );

  return (
    <SafeAreaView sx={{ flex: 1, background: 'background' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <TopBar leading={<BackIconButton onPress={() => router.back()} />} />
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
        <EndSpaceModal
          spaceId={spaceId}
          visible={endOpen}
          onClose={() => setEndOpen(false)}
        />
        <LeaveSpaceModal
          spaceId={spaceId}
          visible={leaveOpen}
          onClose={() => setLeaveOpen(false)}
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
