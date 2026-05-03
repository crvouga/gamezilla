import { PrincipalAvatar } from '@gamezilla/client/profile/principal-avatar';
import type { SpaceMemberRow } from '@gamezilla/client/spaces/types';
import { Box, Text } from '@gamezilla/lib/ui';

export function MiniplayerHostRow({
  hostId,
  hostLabel,
  hostAvatarConfig,
}: {
  hostId: string;
  hostLabel: string;
  hostAvatarConfig: SpaceMemberRow['avatarConfig'];
}) {
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      <PrincipalAvatar
        avatarConfig={hostAvatarConfig}
        principalId={hostId}
        size={22}
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        numberOfLines={1}
        label={hostLabel}
      />
    </Box>
  );
}

const MAX_MEMBER_AVATARS = 3;

export function MiniplayerMemberStack({
  membersForStack,
  surfaceColor,
}: {
  membersForStack: SpaceMemberRow[];
  surfaceColor: string;
}) {
  const visible = membersForStack.slice(0, MAX_MEMBER_AVATARS);
  const overflow = Math.max(0, membersForStack.length - MAX_MEMBER_AVATARS);

  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center' }}>
      {visible.map((member, i) => (
        <Box
          key={member.principalId}
          style={{
            marginLeft: i > 0 ? -6 : 0,
            borderWidth: 2,
            borderColor: surfaceColor,
            borderRadius: 999,
          }}
        >
          <PrincipalAvatar
            avatarConfig={member.avatarConfig}
            principalId={member.principalId}
            size={26}
          />
        </Box>
      ))}
      {overflow > 0 ? (
        <Box
          sx={{
            marginLeft: -6,
            minWidth: 26,
            height: 26,
            borderRadius: 999,
            background: 'tintMuted',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: 'surface',
          }}
        >
          <Text variant="caption" label={`+${overflow}`} />
        </Box>
      ) : null}
    </Box>
  );
}
