import { DeviceAvatar } from '@gamezilla/client/profile/device-avatar';
import type { SpaceMemberRow } from '@gamezilla/client/spaces/types';
import { Box, StatusDot, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';

/* eslint-disable lingui/no-unlocalized-strings -- RGBA / hex style tokens, not copy */
const TITLE_COLOR = '#FFFFFF';
const SUBTITLE_COLOR = 'rgba(255,255,255,0.85)';
const SEPARATOR_COLOR = 'rgba(255,255,255,0.55)';
const BADGE_BG = 'rgba(255,255,255,0.22)';
/* eslint-enable lingui/no-unlocalized-strings */

export function MiniplayerLiveBadge() {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        backgroundColor: BADGE_BG,
        borderRadius: 999,
        px: 2,
        py: 0.5,
      }}
    >
      <StatusDot status="online" size={6} />
      <Text
        variant="caption"
        sx={{ color: TITLE_COLOR }}
        label={<Trans>Live</Trans>}
      />
    </Box>
  );
}

function MiniplayerHostSubtitleRow({
  hostLabel,
  countLabel,
}: {
  hostLabel: string;
  countLabel: string;
}) {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1.5,
        minWidth: 0,
      }}
    >
      <Text
        variant="caption"
        numberOfLines={1}
        sx={{ color: SUBTITLE_COLOR, flexShrink: 1 }}
        label={hostLabel}
      />
      {/* Typographic separator between host label and member count */}
      {/* eslint-disable-next-line gamezillaI18n/text-must-be-trans */}
      <Text variant="caption" sx={{ color: SEPARATOR_COLOR }} label="·" />
      <Text
        variant="caption"
        numberOfLines={1}
        sx={{ color: SUBTITLE_COLOR }}
        label={countLabel}
      />
    </Box>
  );
}

export function MiniplayerHostHeader({
  spaceTitle,
  hostId,
  hostLabel,
  hostAvatarConfig,
  countLabel,
}: {
  spaceTitle: string;
  hostId: string;
  hostLabel: string;
  hostAvatarConfig: SpaceMemberRow['avatarConfig'];
  countLabel: string;
}) {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        flex: 1,
        minWidth: 0,
      }}
    >
      {hostId ? (
        <DeviceAvatar
          avatarConfig={hostAvatarConfig}
          deviceId={hostId}
          size={40}
          vividBackdrop
        />
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
        <Text
          variant="bodyBold"
          numberOfLines={1}
          sx={{ color: TITLE_COLOR }}
          label={spaceTitle}
        />
        <MiniplayerHostSubtitleRow hostLabel={hostLabel} countLabel={countLabel} />
      </Box>
    </Box>
  );
}
