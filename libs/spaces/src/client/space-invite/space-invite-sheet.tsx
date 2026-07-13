import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  ResponsiveSurface,
  ScrollView,
  Text,
  useMutationButton,
} from '@pkgs/ui';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useState, type ReactNode } from 'react';

import {
  SPACE_VISIBILITIES,
  parseSpaceVisibility,
  type SpaceVisibility,
} from '../../shared/space-visibility';
import { useSetVisibility } from '../set-visibility/use-set-visibility';
import { ensureSpaceLinkInvite } from '../spaces-actions';
import { useSpacesClientDeps } from '../use-spaces-client-deps';
import { useSpaceColumn, SpaceField } from '../use-space-column';
import { SpaceInviteFriendRows } from './space-invite-friend-rows';
import { useSpaceInviteFriends } from './use-space-invite-friends';

function buildInviteLink(spaceId: string, token: string): string {
  const origin =
    typeof window !== 'undefined' && window.location !== undefined
      ? window.location.origin
      : '';
  // URL paths are not user-facing copy.
  // eslint-disable-next-line lingui/no-unlocalized-strings
  return `${origin}/space/${spaceId}?invite=${encodeURIComponent(token)}`;
}

function visibilityLabel(
  visibility: SpaceVisibility,
  t: ReturnType<typeof useLingui>['t']
): string {
  if (visibility === 'private') return t`Invite only`;
  if (visibility === 'friends') return t`Friends`;
  return t`Public`;
}

function VisibilityButtons({
  spaceId,
  visibility,
}: {
  readonly spaceId: string;
  readonly visibility: SpaceVisibility;
}): ReactNode {
  const { t } = useLingui();
  const setVisibility = useSetVisibility();
  return (
    <Box sx={{ gap: 2, flexDirection: 'row', flexWrap: 'wrap' }}>
      {SPACE_VISIBILITIES.map((v) => (
        <Button
          key={v}
          size="sm"
          variant={visibility === v ? 'solid' : 'outline'}
          title={visibilityLabel(v, t)}
          onPress={() => void setVisibility(spaceId, v)}
        />
      ))}
    </Box>
  );
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

export function SpaceInviteSheet({
  spaceId,
  open,
  onOpenChange,
}: SpaceInviteSheetProps): ReactNode {
  const { friends } = useSpaceInviteFriends();
  const visibility = parseSpaceVisibility(
    useSpaceColumn(spaceId, SpaceField.visibility)
  );
  const { copyLink, copied } = useCopyInviteLink(spaceId);

  return (
    <ResponsiveSurface
      visible={open}
      onClose={() => onOpenChange(false)}
      title={<Trans>Invite</Trans>}
      size="large"
    >
      <ScrollView style={{ maxHeight: 480 }}>
        <Box sx={{ gap: 3, p: 2 }}>
          <Text label={<Trans>Visibility</Trans>} />
          <VisibilityButtons spaceId={spaceId} visibility={visibility} />
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
