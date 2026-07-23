import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  PickerSection,
  ResponsiveSurface,
  ScrollView,
  Text,
  useMutationButton,
} from '@pkgs/ui';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useState, type ReactNode } from 'react';

import { parseSpaceVisibility } from '../../shared/space-visibility';
import { SpaceVisibilityChips } from '../set-visibility/space-visibility-chips';
import { ensureSpaceLinkInvite } from '../spaces-actions';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { useSpaceColumn, SpaceField } from '../use-space-column';
import { useSpacesClientDeps } from '../use-spaces-client-deps';
import { SpaceInviteFriendRows } from './space-invite-friend-rows';
import { useSpaceInviteFriends } from './use-space-invite-friends';

function buildInviteLink(spaceId: string, token: string): string {
  const origin =
    typeof window !== 'undefined' && window.location !== undefined
      ? window.location.origin
      : '';
  return `${origin}/space/${spaceId}?invite=${encodeURIComponent(token)}`;
}

function useCopyInviteLink(spaceId: string) {
  const { t } = useLingui();
  const deps = useSpacesClientDeps();
  const [copied, setCopied] = useState(false);
  const copyLink = useMutationButton({
    operation: useCallback(async () => {
      const invite = await ensureSpaceLinkInvite(deps, spaceId);
      await Clipboard.setStringAsync(buildInviteLink(spaceId, invite.token));
      setCopied(true);
    }, [deps, spaceId]),
    labels: {
      idle: t`Copy invite link`,
      loading: t`Preparing…`,
      success: t`Copied`,
      error: t`Couldn't copy link`,
    },
  });
  return { copyLink, copied };
}

export type SpaceInviteSheetProps = {
  readonly spaceId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

/** Invite surface: copy link, friend invites, and host visibility. */
export function SpaceInviteSheet({
  spaceId,
  open,
  onOpenChange,
}: SpaceInviteSheetProps): ReactNode {
  const { friends } = useSpaceInviteFriends();
  const { copyLink, copied } = useCopyInviteLink(spaceId);
  const isHost = useCurrentSpaceRole(spaceId) === 'host';
  const visibility = parseSpaceVisibility(
    useSpaceColumn(spaceId, SpaceField.visibility)
  );

  return (
    <ResponsiveSurface
      visible={open}
      onClose={() => onOpenChange(false)}
      title={<Trans>Invite</Trans>}
      size="large"
    >
      <ScrollView style={{ maxHeight: 480 }}>
        <Box sx={{ gap: 3, p: 2 }}>
          {isHost ? (
            <PickerSection label={<Trans>Who can join</Trans>}>
              <SpaceVisibilityChips spaceId={spaceId} visibility={visibility} />
            </PickerSection>
          ) : null}
          <Button {...copyLink.buttonProps} />
          {copied ? (
            <Text
              variant="caption"
              label={<Trans>Link copied to clipboard</Trans>}
            />
          ) : null}
          <Text label={<Trans>Invite friends</Trans>} />
          <SpaceInviteFriendRows spaceId={spaceId} friends={friends} />
        </Box>
      </ScrollView>
    </ResponsiveSurface>
  );
}
